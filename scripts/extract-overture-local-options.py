#!/usr/bin/env python3
"""Extract 20 real place names per Topo Local category from Overture Maps.

This build-only helper expects the two Overture Places GeoParquet partitions that
cover Brazil. Install `duckdb` and `shapely`, then pass their local paths. The
municipal polygons are resolved through Nominatim at its public 1 req/s limit.
"""

from __future__ import annotations

import argparse
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

import duckdb
from shapely.geometry import Point, shape
from shapely.prepared import prep


USER_AGENT = "SomosTopoCatalog/1.0 (https://somostopo.com.br; contato@somostopo.com.br)"
RELEASE = "2026-08-19.0"

CITIES = [
    ("São Paulo", "SP", "sp"),
    ("Rio de Janeiro", "RJ", "rio"),
    ("Brasília", "DF", "brasilia"),
    ("Fortaleza", "CE", "fortaleza"),
    ("Salvador", "BA", "salvador"),
    ("Belo Horizonte", "MG", "belo-horizonte"),
    ("Manaus", "AM", "manaus"),
    ("Curitiba", "PR", "curitiba"),
    ("Recife", "PE", "recife"),
    ("Goiânia", "GO", "goiania"),
    ("Belém", "PA", "belem"),
    ("Porto Alegre", "RS", "porto-alegre"),
    ("Guarulhos", "SP", "guarulhos"),
    ("Campinas", "SP", "campinas"),
    ("São Luís", "MA", "sao-luis"),
    ("Maceió", "AL", "maceio"),
    ("Campo Grande", "MS", "campo-grande"),
    ("São Gonçalo", "RJ", "sao-goncalo"),
    ("Teresina", "PI", "teresina"),
    ("João Pessoa", "PB", "joao-pessoa"),
    ("Florianópolis", "SC", "floripa"),
]

NAME_PATTERNS = {
    "pizza": r"\b(?:pizza|pizzaria|pizzeria|forneria)\b",
    "burger": r"\b(?:burger|burguer|hamburguer|hamburger|hamburgueria)\b",
    "sushi": r"\b(?:sushi|temaki|japones|japanese|izakaya|ramen|yakisoba|nikkei)\b",
    "cafe": r"\b(?:cafe|cafeteria|coffee)\b",
    "beauty": r"\b(?:salao|beleza|beauty|cabeleireir|hair salon|esmalteria)\b",
    "barber": r"\b(?:barber|barbearia|barbeiro|barbershop)\b",
    "gym": r"\b(?:academia|fitness|crossfit|cross training|gym|musculacao)\b",
    "pet": r"\b(?:pet shop|petshop|pet center|petz|cobasi|petland)\b",
    "dentist": r"\b(?:dentista|dental|odonto|odontologia|ortodont)\b",
    "italian": r"\b(?:italian|italiano|italiana|ristorante|trattoria|osteria|cantina)\b",
    "bakery": r"\b(?:padaria|panificadora|panificacao|bakery|boulangerie)\b",
    "buffet": r"\b(?:quilo|buffet|self service|selfservice|self-service)\b",
    "vegan": r"\b(?:vegano|vegana|vegan|vegetariano|vegetariana|vegetarian|plant based|natural|organico|saudavel)\b",
    "thrift": r"\b(?:brecho|bazar|thrift|second hand|segunda mao|reuso)\b",
}

GENERIC_NAMES = {
    "restaurante",
    "lanchonete",
    "pizzaria",
    "padaria",
    "academia",
    "barbearia",
    "salao",
    "dentista",
    "brecho",
    "bazar",
    "cafe",
    "pet shop",
}

# Curated only where the open dataset has fewer than 20 reliable candidates.
CURATED_OVERRIDES = {
    ("teresina", "thrift"): [
        "Brechorizei - Brechó Online em Teresina",
        "Closet Brechó",
        "Peça Rara Brechó - Jóquei Teresina",
        "Brechó Chita Filó",
        "Meu Velho Seu Novo Brechó",
        "Renove Second Hand Luxo",
        "Capi Brechó",
        "D'Zapega Store",
        "Tudo de Brechó Teresina",
        "Brechó Ovelha Verde",
        "Desapego da Lenna",
        "Lojinha Lixo",
        "TT Brechó",
        "Brechó Laly",
        "Brechó Peça Curinga",
        "Brechó da Flor",
        "Brechó Era da Rafa",
        "Brechó Flor de Cacto",
        "Madame Brechó",
        "Brechó Infantil Sementinhas",
    ]
}


def fold(value: object) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def municipal_boundary(name: str, state: str):
    search_name = "Distrito Federal" if state == "DF" else name
    query = urllib.parse.urlencode(
        {
            "format": "jsonv2",
            "addressdetails": 1,
            "polygon_geojson": 1,
            "polygon_threshold": 0.0002,
            "limit": 8,
            "countrycodes": "br",
            "q": f"{search_name}, Brasil" if state == "DF" else f"{search_name}, {state}, Brasil",
        }
    )
    request = urllib.request.Request(
        f"https://nominatim.openstreetmap.org/search?{query}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        results = json.load(response)
    selected = next(
        (
            item
            for item in results
            if item.get("osm_type") == "relation"
            and item.get("geojson", {}).get("type") in {"Polygon", "MultiPolygon"}
            and state.lower()
            in str(
                item.get("address", {}).get("state_code")
                or item.get("address", {}).get("ISO3166-2-lvl4")
                or ""
            ).lower()
        ),
        None,
    )
    if not selected:
        selected = next(
            (
                item
                for item in results
                if item.get("osm_type") == "relation"
                and item.get("geojson", {}).get("type") in {"Polygon", "MultiPolygon"}
            ),
            None,
        )
    if not selected:
        raise RuntimeError(f"Limite municipal não encontrado: {name}/{state}")
    south, north, west, east = map(float, selected["boundingbox"])
    return prep(shape(selected["geojson"])), (west, south, east, north)


def categories_for(place: dict) -> set[str]:
    primary = fold(place.get("primary")).replace(" ", "_")
    basic = fold(place.get("basic")).replace(" ", "_")
    hierarchy = {
        fold(value).replace(" ", "_") for value in (place.get("hierarchy") or [])
    }
    name = fold(place.get("name"))
    is_restaurant = "restaurant" in hierarchy or basic == "restaurant"
    result: set[str] = set()

    if is_restaurant:
        result.add("restaurants")
    if "pizza_restaurant" in hierarchy or re.search(NAME_PATTERNS["pizza"], name):
        result.add("pizza")
    if "burger_restaurant" in hierarchy or re.search(NAME_PATTERNS["burger"], name):
        result.add("burger")
    if hierarchy.intersection(
        {"sushi_restaurant", "japanese_restaurant", "ramen_restaurant"}
    ) or (is_restaurant and re.search(NAME_PATTERNS["sushi"], name)):
        result.add("sushi")
    if hierarchy.intersection({"cafe", "coffee_shop"}) or re.search(
        NAME_PATTERNS["cafe"], name
    ):
        result.add("cafe")
    if hierarchy.intersection(
        {"beauty_salon", "hair_salon", "nail_salon", "beauty_and_spa"}
    ) or re.search(NAME_PATTERNS["beauty"], name):
        result.add("beauty")
    if "barber" in hierarchy or re.search(NAME_PATTERNS["barber"], name):
        result.add("barber")
        result.discard("beauty")
    if hierarchy.intersection({"gym", "fitness_club", "health_club"}) or re.search(
        NAME_PATTERNS["gym"], name
    ):
        result.add("gym")
    if hierarchy.intersection(
        {"pet_store", "pet_grooming", "animal_and_pet_store"}
    ) or re.search(NAME_PATTERNS["pet"], name):
        result.add("pet")
    if "dental_clinic" in hierarchy or re.search(NAME_PATTERNS["dentist"], name):
        result.add("dentist")
    if "italian_restaurant" in hierarchy or (
        is_restaurant and re.search(NAME_PATTERNS["italian"], name)
    ):
        result.add("italian")
    if "bakery" in hierarchy or re.search(NAME_PATTERNS["bakery"], name):
        result.add("bakery")
    if "buffet_restaurant" in hierarchy or (
        is_restaurant and re.search(NAME_PATTERNS["buffet"], name)
    ):
        result.add("buffet")
    if hierarchy.intersection(
        {"vegan_restaurant", "vegetarian_restaurant", "health_food_store"}
    ) or (
        hierarchy.intersection({"restaurant", "cafe", "food_and_beverage_store"})
        and re.search(NAME_PATTERNS["vegan"], name)
    ):
        result.add("vegan")
    if hierarchy.intersection(
        {"second_hand_store", "second_hand_clothing_store", "flea_market"}
    ) or re.search(NAME_PATTERNS["thrift"], name):
        result.add("thrift")
    return result


def clean_name(value: object) -> str | None:
    name = re.sub(r"\s+", " ", str(value or "")).strip()
    normalized = fold(name)
    if not 3 <= len(name) <= 80 or normalized in GENERIC_NAMES:
        return None
    if not re.search(r"[a-z]", normalized) or normalized.isdigit():
        return None
    return name


def score(place: dict, category: str) -> float:
    value = float(place.get("confidence") or 0) * 100
    value += min(int(place.get("source_count") or 0), 4) * 2
    value += 2 if place.get("has_website") else 0
    value += 1 if place.get("has_phone") else 0
    value += 1 if place.get("has_social") else 0
    primary = fold(place.get("primary")).replace(" ", "_")
    exact = {
        "pizza": "pizza_restaurant",
        "burger": "burger_restaurant",
        "sushi": "sushi_restaurant",
        "cafe": "cafe",
        "beauty": "beauty_salon",
        "barber": "barber",
        "gym": "gym",
        "pet": "pet_store",
        "dentist": "dental_clinic",
        "italian": "italian_restaurant",
        "bakery": "bakery",
        "buffet": "buffet_restaurant",
        "vegan": "vegan_restaurant",
        "thrift": "second_hand_store",
    }.get(category)
    if exact and primary == exact:
        value += 5
    if category == "vegan" and primary == "vegetarian_restaurant":
        value += 4
    if category == "vegan" and re.search(r"\b(?:vegano|vegana|vegan)\b", fold(place.get("name"))):
        value += 3
    return value


def places_in_city(connection, paths: list[str], bbox, polygon):
    west, south, east, north = bbox
    placeholders = ", ".join("?" for _ in paths)
    query = f"""
        SELECT
          names.primary AS name,
          basic_category AS basic,
          taxonomy.primary AS primary,
          taxonomy.hierarchy AS hierarchy,
          confidence,
          bbox.xmin AS longitude,
          bbox.ymin AS latitude,
          len(sources) AS source_count,
          len(websites) > 0 AS has_website,
          len(phones) > 0 AS has_phone,
          len(socials) > 0 AS has_social
        FROM read_parquet([{placeholders}], union_by_name = true)
        WHERE bbox.xmin BETWEEN ? AND ?
          AND bbox.ymin BETWEEN ? AND ?
          AND names.primary IS NOT NULL
          AND coalesce(operating_status, 'open') <> 'permanently_closed'
    """
    rows = connection.execute(query, [*paths, west, east, south, north]).fetchall()
    columns = [item[0] for item in connection.description]
    places = []
    for row in rows:
        place = dict(zip(columns, row))
        if polygon.covers(Point(place["longitude"], place["latitude"])):
            places.append(place)
    return places


def options_for_city(places: list[dict], city_name: str):
    candidates = {key: {} for key in (
        "restaurants", "pizza", "burger", "sushi", "cafe", "beauty", "barber",
        "gym", "pet", "dentist", "italian", "bakery", "buffet", "vegan", "thrift"
    )}
    for place in places:
        name = clean_name(place.get("name"))
        if not name:
            continue
        normalized = fold(name)
        for category in categories_for(place):
            candidate_score = score(place, category)
            current = candidates[category].get(normalized)
            if not current or candidate_score > current[0]:
                candidates[category][normalized] = (candidate_score, name)

    result = {}
    for category, entries in candidates.items():
        ordered = sorted(entries.values(), key=lambda item: (-item[0], fold(item[1])))
        result[category] = [name for _, name in ordered[:20]]
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--south", required=True, help="GeoParquet partition south of -21.37")
    parser.add_argument("--north", required=True, help="GeoParquet partition north of -21.37")
    parser.add_argument("--output", default="/tmp/somos-topo-local-seed.json")
    parser.add_argument("--city", help="Optional city slug for a focused validation run")
    args = parser.parse_args()

    south_path = str(Path(args.south).resolve())
    north_path = str(Path(args.north).resolve())
    selected = [city for city in CITIES if not args.city or city[2] == args.city]
    if not selected:
        raise RuntimeError(f"Cidade desconhecida: {args.city}")

    connection = duckdb.connect()
    output = {
        "source": f"Overture Maps Foundation {RELEASE}",
        "accessed": "2026-08-24",
        "cities": {},
    }
    incomplete = []
    for index, (name, state, slug) in enumerate(selected, start=1):
        print(f"[{index}/{len(selected)}] {name}: limite municipal", flush=True)
        polygon, bbox = municipal_boundary(name, state)
        paths = []
        if bbox[1] <= -21.3747615814209:
            paths.append(south_path)
        if bbox[3] >= -21.3747615814209:
            paths.append(north_path)
        print(f"[{index}/{len(selected)}] {name}: pontos Overture", flush=True)
        places = places_in_city(connection, paths, bbox, polygon)
        output["cities"][slug] = options_for_city(places, name)
        for (override_slug, category), labels in CURATED_OVERRIDES.items():
            if override_slug == slug:
                output["cities"][slug][category] = labels
        counts = output["cities"][slug]
        incomplete.extend(
            f"{slug}/{key}={len(value)}" for key, value in counts.items() if len(value) < 20
        )
        print(
            f"[{index}/{len(selected)}] {name}: {len(places)} pontos; "
            + ", ".join(f"{key}={len(value)}" for key, value in counts.items()),
            flush=True,
        )
        if index < len(selected):
            time.sleep(1.1)

    Path(args.output).write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Sementes salvas em {args.output}", flush=True)
    if incomplete:
        raise RuntimeError("Categorias incompletas: " + ", ".join(incomplete))


if __name__ == "__main__":
    main()
