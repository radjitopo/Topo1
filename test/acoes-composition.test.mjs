import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const page = await readFile(new URL('../acoes-nz.html',import.meta.url),'utf8');
const source = page.slice(page.indexOf('function normalizeVisualEvent('),page.indexOf('function buildVisualTiles('));
const engine = vm.runInNewContext(`${source}; ({createVisualArt,advanceSonicVisualArt,isSonicVisualStyle});`);
const modes = ['topography','flow','interference','architecture'];
const plain = value => JSON.parse(JSON.stringify(value));
const market = Array.from({length:120},(_,i)=>({direction:['up','down','flat'][i%3],intensity:.12+(i%8)/10,key:`tokyo:${i%30}`}));
const notes = [{layer:'bass',voice:'bass',midi:36,volume:.13},{layer:'lead',voice:'lead',midi:76,volume:.12},{layer:'chords',voice:'chord',midi:55,volume:.025},{layer:'drums',voice:'kick',volume:.55}];
function replay(mode,seed=47,input=market){
  const art = engine.createVisualArt(mode,1080,1920,10,5,seed);
  input.forEach(event=>engine.advanceSonicVisualArt(art,event));
  notes.forEach(note=>engine.advanceSonicVisualArt(art,note));
  return plain(art.sound);
}

test('sonic compositions replay and respond to seed and ascending/descending movements',()=>{
  for(const mode of modes){
    assert.equal(engine.isSonicVisualStyle(mode),true);
    assert.deepEqual(replay(mode),replay(mode));
    assert.notDeepEqual(replay(mode),replay(mode,48));
    assert.notDeepEqual(replay(mode,47,market.map(e=>({...e,direction:'up'}))),replay(mode,47,market.map(e=>({...e,direction:'down'}))));
  }
});

test('each audible music layer controls its own compositional parameter',()=>{
  const art = engine.createVisualArt('topography',1080,1920,10,5,47);
  const before = plain(art.sound);
  engine.advanceSonicVisualArt(art,notes[0]);
  assert.notEqual(art.sound.bass,before.bass);
  assert.equal(art.sound.pitch,before.pitch);
  const bass = art.sound.bass;
  engine.advanceSonicVisualArt(art,notes[1]);
  assert.notEqual(art.sound.pitch,before.pitch);
  assert.equal(art.sound.bass,bass);
  engine.advanceSonicVisualArt(art,notes[2]);
  assert.notEqual(art.sound.chords,before.chords);
  const rhythm = plain(art.sound.rhythm);
  engine.advanceSonicVisualArt(art,notes[3]);
  assert.notDeepEqual(plain(art.sound.rhythm),rhythm);
});

test('long-running compositions stay bounded and keep evolving past the old completion limit',()=>{
  const art = engine.createVisualArt('flow',1080,1920,30,10,47);
  for(let i=0;i<20000;i++){
    engine.advanceSonicVisualArt(art,market[i%market.length]);
    engine.advanceSonicVisualArt(art,notes[i%notes.length]);
  }
  assert.equal(art.index,20000);
  assert.equal(art.limit,Infinity);
  for(const key of ['pitch','energy','bass','chords']) assert.ok(Number.isFinite(art.sound[key])&&art.sound[key]>=0&&art.sound[key]<=1);
  assert.ok(art.sound.direction>=-1&&art.sound.direction<=1);
  assert.ok(art.sound.phase>=0&&art.sound.phase<Math.PI*2);
  assert.equal(art.sound.rhythm.length,8);
});

test('Cartografia sonora is the default and valid saved artistic choices survive reload',()=>{
  const styles = page.slice(page.indexOf('const VISUAL_STYLES ='),page.indexOf('const DEFAULT_SOUND_VOLUME ='));
  const preferences = page.slice(page.indexOf('function storedVisualStyle('),page.indexOf('function storedVisualComplexity('));
  const choose = saved => vm.runInNewContext(`${styles}\n${preferences}\nstoredVisualStyle();`,{VISUAL_STYLE_STORAGE_KEY:'style',localStorage:{getItem:()=>saved}});
  assert.equal(choose(null),'topography');
  assert.equal(choose('invalid'),'topography');
  for(const mode of [...modes,'pollock','standard']) assert.equal(choose(mode),mode);
});
