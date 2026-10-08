import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const page = await readFile(new URL('../acoes-nz.html', import.meta.url), 'utf8');
const section = page.slice(page.indexOf('function normalizeVisualEvent('), page.indexOf('function buildVisualTiles('));
const engine = vm.runInNewContext(`${section}; ({createVisualArt,nextVisualArt});`);
const make = () => engine.createVisualArt('snake',1080,1920,10,5,41);
const plain = input => JSON.parse(JSON.stringify(input));

test('Cobrinha is available as an independent visual style', () => {
  assert.match(page,/data-visual-style="snake"[^>]*>Cobrinha<\/button>/);
  assert.match(page,/snake:\{label:"Cobrinha"/);
  assert.match(page,/state\.visualColors\.up/);
  assert.match(page,/state\.visualColors\.down/);
});

test('begins moving down, turns left on rises and right on falls', () => {
  const art = make();
  const first = plain(engine.nextVisualArt(art,{direction:'up',intensity:.5}));
  assert.equal(first.length,2);
  assert.ok(first[0].points[1][1] > first[0].points[0][1], 'initial movement is down');
  assert.ok(first[1].points[1][0] > first[1].points[0][0], 'up from down turns right on screen');
  assert.equal(art.snake.heading,0);
  const down = plain(engine.nextVisualArt(art,{direction:'down'}));
  assert.ok(down[0].points[1][1] > down[0].points[0][1], 'fall turns 90 degrees clockwise');
  assert.equal(art.snake.heading,1);
  const flat = plain(engine.nextVisualArt(art,{direction:'flat'}));
  assert.ok(flat[0].points[1][1] > flat[0].points[0][1], 'flat keeps direction');
});

test('turns are always 90 degrees relative to current heading', () => {
  for(let heading=0;heading<4;heading++){
    for(const [signal,delta] of [['up',3],['down',1],['flat',0]]){
      const art=make();
      art.index=1;
      art.snake={x:540,y:960,heading};
      engine.nextVisualArt(art,{direction:signal});
      assert.equal(art.snake.heading,(heading+delta)%4);
    }
  }
});

test('bounces back from all four walls and stays on canvas', () => {
  for(const [x,y,heading] of [[1040,500,0],[40,500,2],[500,1870,1],[500,40,3]]){
    const art=make();
    art.index=1;
    art.snake={x,y,heading};
    const commands=plain(engine.nextVisualArt(art,{direction:'flat'}));
    assert.ok(commands.length>=2,'crossing the wall should create return path');
    assert.equal(art.snake.heading,(heading+2)%4);
    assert.ok(commands.every(command=>command.type==='snake'));
    for(const command of commands){
      for(const [px,py] of command.points){
        assert.ok(px>=0 && px<=1080 && py>=0 && py<=1920);
      }
    }
  }
});

test('replays the same market data exactly and remains bounded', () => {
  const events=Array.from({length:3500},(_,i)=>({direction:['up','flat','down'][i%3],intensity:.12+(i%8)/10,key:String(i%30)}));
  function render(){
    const art=make();
    const commands=[];
    for(const event of events){
      const next=plain(engine.nextVisualArt(art,event));
      commands.push(next);
      for(const command of next){
        assert.ok(command.width>0 && command.alpha>0);
        for(const [x,y] of command.points)assert.ok(x>=0&&x<=1080&&y>=0&&y<=1920);
      }
    }
    return {commands,position:plain(art.snake)};
  }
  assert.deepEqual(render(),render());
});
