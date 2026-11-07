// Aurora's rebuilt 16-bit pixel-art architecture.
// Every structure is authored on a low-resolution pixel canvas and enlarged
// with nearest-neighbour sampling. No gradients, blur, SVG, emoji or old art.
const PALETTES = Object.freeze({
  hall:    { wall:'#d6bd91', shade:'#9a7958', timber:'#513b30', roof:'#394653', roof2:'#536578', trim:'#e7d3a8', glass:'#ffd27a', stone:'#77796f', accent:'#c7a45e' },
  forge:   { wall:'#b98b63', shade:'#80573f', timber:'#49352c', roof:'#3d3438', roof2:'#65464a', trim:'#d9b17c', glass:'#ff9b45', stone:'#69645d', accent:'#e36b36' },
  healer:  { wall:'#e0d2aa', shade:'#a99a73', timber:'#65533c', roof:'#526a4e', roof2:'#718b60', trim:'#f0e2bd', glass:'#ffe09a', stone:'#858575', accent:'#79a66b' },
  alchemy: { wall:'#c6b092', shade:'#89755e', timber:'#493e3c', roof:'#405761', roof2:'#607c82', trim:'#dfc99d', glass:'#9de0c2', stone:'#6f7370', accent:'#9a83c6' },
  market:  { wall:'#d2ad7b', shade:'#9b754e', timber:'#65412f', roof:'#a94f3d', roof2:'#d17b4f', trim:'#f1d39c', glass:'#ffdc91', stone:'#8b806c', accent:'#e3b85f' },
  tavern:  { wall:'#c69a70', shade:'#8a6045', timber:'#51372c', roof:'#4a3835', roof2:'#795247', trim:'#e7c18c', glass:'#ffca70', stone:'#777064', accent:'#b95e43' },
  home:    { wall:'#d0bd96', shade:'#9b8768', timber:'#594532', roof:'#59634c', roof2:'#7d8a61', trim:'#e8d4aa', glass:'#f8d58c', stone:'#817c6c', accent:'#b78b55' }
});
const cache = new Map();
const W = 104, H = 92, SCALE = 3;
function rect(c,x,y,w,h,color){ c.fillStyle=color; c.fillRect(x,y,w,h); }
function row(c,x,y,w,color){ rect(c,x,y,w,1,color); }
function pixel(c,x,y,color){ rect(c,x,y,1,1,color); }
function windowBox(c,x,y,p,wide=9){
  rect(c,x-1,y-1,wide+2,13,p.timber); rect(c,x,y,wide,11,p.glass);
  rect(c,x+Math.floor(wide/2),y,1,11,p.timber); rect(c,x,y+5,wide,1,p.timber);
  rect(c,x-2,y-2,wide+4,2,p.trim); rect(c,x-2,y+11,wide+4,2,p.trim);
  rect(c,x-3,y+13,wide+6,2,p.timber);
}
function door(c,x,y,p){
  rect(c,x-2,y-2,15,23,p.timber); rect(c,x,y,11,20,'#69452f');
  rect(c,x+2,y+2,7,7,'#875b3a'); rect(c,x+2,y+11,7,7,'#805337');
  rect(c,x+9,y+10,1,2,p.accent); rect(c,x-4,y+20,19,3,p.stone);
}
function roofGable(c,p,left=12,right=92,peak=50,base=35){
  // Stepped roof silhouette: crisp one-pixel courses and a strong dark eave.
  rect(c,left+12,peak+8,right-left-24,base-peak-8,p.roof);
  for(let n=0;n<12;n++){
    const inset=n*2, yy=peak+Math.floor(n*1.25);
    rect(c,left+inset,yy,right-left-inset*2,2,n%3===0?p.roof2:p.roof);
  }
  rect(c,left+8,base-1,right-left-16,4,p.timber);
  for(let x=left+13;x<right-12;x+=8) rect(c,x,peak+8+Math.floor((x-left)/8),2,base-peak-10,p.roof2);
  row(c,left+10,peak+1,right-left-20,p.trim);
}
function baseBuilding(c,p,variant){
  rect(c,8,43,88,37,p.timber);
  rect(c,11,42,82,34,p.wall); rect(c,53,42,40,34,p.shade);
  rect(c,11,72,82,8,p.stone);
  for(let x=13;x<92;x+=13){rect(c,x,73,1,6,p.trim);rect(c,x+5,77,5,1,'#55564f');}
  rect(c,11,43,4,30,p.trim); rect(c,89,43,4,30,p.timber);
  rect(c,49,43,4,34,p.timber);
  if(variant!=='market') {windowBox(c,20,52,p,9);windowBox(c,73,52,p,9);}
  door(c,46,57,p);
  rect(c,7,79,90,3,'#4b4037');
}
function drawHall(c,p){
  // Town hall: high central tower, two wings, bell openings and royal crest.
  baseBuilding(c,p,'hall'); roofGable(c,p,8,96,20,48);
  rect(c,38,4,29,39,p.timber);rect(c,41,7,23,35,p.wall);rect(c,53,7,11,35,p.shade);
  roofGable(c,p,32,73,1,15);rect(c,44,0,15,4,p.accent);
  rect(c,46,20,5,10,p.timber);rect(c,56,20,5,10,p.timber);
  rect(c,48,22,1,6,p.glass);rect(c,58,22,1,6,p.glass);
  rect(c,50,13,5,3,p.trim);rect(c,52,10,1,9,p.accent);
  rect(c,48,36,10,4,p.timber);rect(c,14,40,76,3,p.trim);
  rect(c,44,46,17,4,p.accent);rect(c,50,45,5,7,p.trim);
  rect(c,18,33,6,9,p.timber);rect(c,79,33,6,9,p.timber);
}
function drawForge(c,p){
  baseBuilding(c,p,'forge'); roofGable(c,p,8,95,20,48);
  rect(c,75,5,13,37,p.timber);rect(c,78,8,7,31,p.stone);rect(c,73,4,17,5,p.trim);
  rect(c,79,12,5,7,p.accent);rect(c,80,13,3,4,'#ffb45b');
  rect(c,17,46,19,3,p.timber);rect(c,18,49,3,9,p.stone);rect(c,32,49,3,9,p.stone);
  rect(c,21,44,12,3,p.accent);rect(c,24,41,6,3,'#ffb35a');
  rect(c,11,61,20,10,p.timber);rect(c,14,59,14,3,p.stone);rect(c,18,55,7,5,'#8c9390');
  rect(c,34,66,7,3,p.accent);rect(c,35,63,5,3,'#ff9b45');
}
function drawHealer(c,p){
  baseBuilding(c,p,'healer'); roofGable(c,p,9,95,24,48);
  rect(c,40,27,24,16,p.trim);rect(c,43,30,18,10,p.wall);
  rect(c,51,28,3,13,p.accent);rect(c,46,33,13,3,p.accent);
  rect(c,12,44,18,4,p.timber);rect(c,14,39,14,5,p.accent);
  rect(c,13,37,3,7,'#638d58');rect(c,19,34,3,10,'#779d5b');rect(c,25,37,3,7,'#638d58');
  rect(c,72,44,18,4,p.timber);rect(c,74,39,14,5,p.accent);
  for(let x=15;x<31;x+=5){pixel(c,x,55,'#83a65e');pixel(c,x+1,53,'#d6a7c0');}
  rect(c,37,78,30,3,p.accent);
}
function drawAlchemy(c,p){
  baseBuilding(c,p,'alchemy'); roofGable(c,p,7,96,18,48);
  rect(c,69,5,13,38,p.timber);rect(c,72,8,7,30,p.stone);rect(c,67,3,17,5,p.trim);
  rect(c,72,14,7,7,p.accent);rect(c,74,16,3,3,p.glass);
  rect(c,15,43,18,5,p.timber);rect(c,17,48,14,3,p.accent);
  rect(c,20,51,7,10,p.glass);rect(c,22,48,3,4,p.trim);rect(c,21,59,5,2,p.accent);
  rect(c,76,48,8,12,p.glass);rect(c,78,45,4,4,p.trim);
  rect(c,44,43,17,5,p.timber);rect(c,49,39,7,4,p.accent);
  rect(c,47,34,12,5,p.glass);rect(c,50,30,6,5,p.trim);
  pixel(c,53,32,'#d8f6df');
}
function drawMarket(c,p){
  // Open trade hall with two vivid awnings and stall tables, not a closed house.
  rect(c,8,45,88,35,p.timber);rect(c,12,53,80,25,p.wall);
  rect(c,9,41,86,5,p.timber);rect(c,13,46,78,3,p.trim);
  for(let x=12;x<94;x+=8){rect(c,x,25,7,18,x%2?p.roof:p.roof2);rect(c,x,24,7,3,p.trim);}
  roofGable(c,p,8,96,17,30);
  rect(c,14,56,76,4,p.timber);rect(c,17,60,4,15,p.timber);rect(c,83,60,4,15,p.timber);
  rect(c,20,52,20,7,p.accent);rect(c,44,52,20,7,'#6b8d68');rect(c,68,52,18,7,'#bd7650');
  rect(c,20,64,64,4,p.timber);
  for(let x=22;x<83;x+=9){rect(c,x,68,5,6,p.accent);pixel(c,x+1,67,p.trim);}
  rect(c,8,78,88,3,p.stone);
}
function drawTavern(c,p){
  baseBuilding(c,p,'tavern');roofGable(c,p,6,98,17,48);
  rect(c,17,35,70,5,p.timber);rect(c,20,30,64,5,p.roof2);
  rect(c,19,29,4,13,p.timber);rect(c,81,29,4,13,p.timber);
  rect(c,24,33,56,3,p.trim);
  rect(c,33,49,38,5,p.timber);rect(c,36,46,32,4,p.glass);
  rect(c,37,46,2,8,p.timber);rect(c,65,46,2,8,p.timber);
  rect(c,37,57,30,3,p.accent);rect(c,42,60,3,8,p.timber);rect(c,60,60,3,8,p.timber);
  rect(c,73,5,12,38,p.timber);rect(c,76,8,6,31,p.stone);rect(c,71,3,16,5,p.trim);
}
function drawHome(c,p){
  baseBuilding(c,p,'home');roofGable(c,p,8,96,26,48);
  rect(c,76,17,9,26,p.timber);rect(c,78,19,5,20,p.stone);rect(c,75,15,11,4,p.trim);
  rect(c,16,43,15,4,p.accent);rect(c,18,47,11,2,p.trim);
  rect(c,75,43,14,4,p.accent);
}
function makeBuilding(style,variant='default'){
  const c=document.createElement('canvas');c.width=W;c.height=H;
  const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  const basePalette=PALETTES[style]||PALETTES.home;
  const p=style==='home'&&variant==='home-se'
    ? {...basePalette,wall:'#d8c49d',shade:'#aa8d68',roof:'#76504a',roof2:'#a76b55',accent:'#c58c58'}
    : basePalette;
  rect(g,4,82,96,6,'#384034');rect(g,8,80,88,3,'#59624a');
  ({hall:drawHall,forge:drawForge,healer:drawHealer,alchemy:drawAlchemy,market:drawMarket,tavern:drawTavern,home:drawHome}[style]||drawHome)(g,p);
  // Architectural finish pass: roof courses, projecting eaves, readable craft props,
  // and small foreground garden pieces make each silhouette feel inhabited.
  function roofCourses(){
    // Tile accents follow each roof's actual gable footprint. The previous
    // one-size-fits-all pass crossed roof edges and painted horizontal marks
    // over walls, flattening the silhouettes of the individual buildings.
    const roofShape = {
      hall: [8, 96, 20, 48], forge: [8, 95, 20, 48],
      healer: [9, 95, 24, 48], alchemy: [7, 96, 18, 48],
      market: [8, 96, 17, 30], tavern: [6, 98, 17, 48],
      home: [8, 96, 26, 48]
    }[style] || [8, 96, 26, 48];
    const [left, right, peak, base] = roofShape;
    for(let yy=peak+9; yy<base-3; yy+=4){
      const step=Math.round((yy-peak)/1.25);
      const inset=step*2;
      const start=left+inset+3, end=right-inset-3;
      for(let xx=start; xx<end; xx+=12){
        rect(g,xx,yy,7,1,((Math.floor((yy-peak)/4)+Math.floor(xx/12))%3===0)?p.roof2:p.roof);
        pixel(g,xx+7,yy,p.trim);
      }
    }
    // A continuous dark eave and evenly spaced pale rafter ends anchor the roof.
    rect(g,left+8,base-1,right-left-16,3,p.timber);
    for(let xx=left+12;xx<right-10;xx+=12) rect(g,xx,base+1,2,2,p.trim);
  }
  roofCourses();
  if(style==='home'&&variant==='home-se'){
    // The southern cottage has a compact front dormer and a second chimney,
    // making it visibly distinct from the northern half-timbered residence.
    rect(g,40,27,24,15,p.timber);rect(g,43,30,18,12,p.wall);
    rect(g,46,32,12,8,p.glass);rect(g,51,32,2,8,p.timber);
    rect(g,37,27,30,3,p.roof);rect(g,40,24,24,3,p.roof2);
    rect(g,17,16,9,27,p.timber);rect(g,19,18,5,23,p.stone);
    rect(g,15,14,13,3,p.trim);
  }
  // Repeated timber braces and stone foundation joints, deliberately irregular.
  for(let xx=14;xx<92;xx+=18){
    rect(g,xx,44,2,27,p.timber);
    rect(g,xx+2,44,4,2,p.trim);
    rect(g,xx-1,70,5,2,p.stone);
  }
  // Lanterns are warm pixel clusters, never blurred lighting.
  function lantern(xx,yy){
    rect(g,xx,yy,4,5,p.timber); pixel(g,xx+1,yy+2,'#ffd87a');
    pixel(g,xx+2,yy+2,'#ffe9a6'); rect(g,xx+1,yy+5,2,1,p.accent);
  }
  lantern(36,49); lantern(64,49);
  // Individual building identities: signboards, planters, barrels, craft displays.
  if(style==='hall'){
    rect(g,41,31,22,5,p.timber);rect(g,43,32,18,2,p.accent);
    pixel(g,51,32,'#f5e3b8');pixel(g,52,32,'#f5e3b8');
    rect(g,37,78,30,2,p.trim);
    for(let xx=39;xx<66;xx+=6){pixel(g,xx,76,p.accent);pixel(g,xx+1,75,p.trim);}
  } else if(style==='forge'){
    rect(g,9,53,16,3,p.timber);rect(g,11,51,12,2,p.accent);
    rect(g,13,54,8,4,'#ff9b45');pixel(g,15,53,'#ffd27a');
    rect(g,82,58,8,12,p.timber);rect(g,84,56,4,3,p.trim);
    rect(g,87,58,2,5,p.accent);
  } else if(style==='healer'){
    // Herb troughs and colored medicinal bottles along the wall.
    rect(g,12,67,18,5,p.timber);rect(g,13,66,16,2,p.stone);
    for(let xx=14;xx<28;xx+=4){pixel(g,xx,64,'#7eaa69');pixel(g,xx+1,63,'#b7cf83');}
    rect(g,73,67,15,5,p.timber);
    pixel(g,76,65,'#91d4c1');pixel(g,80,64,'#d9a9c5');pixel(g,85,65,'#f1d88a');
  } else if(style==='alchemy'){
    rect(g,10,64,13,6,p.timber);rect(g,12,62,9,3,p.trim);
    pixel(g,14,61,'#9de0c2');pixel(g,17,60,'#bca6e0');
    rect(g,82,64,9,6,p.timber);pixel(g,84,62,'#9de0c2');pixel(g,87,61,'#d7b8ed');
    rect(g,41,53,3,9,p.timber);rect(g,39,51,7,3,p.trim);
  } else if(style==='market'){
    // Awnings now carry scalloped hems and merchandise silhouettes.
    for(let xx=20;xx<88;xx+=12){
      rect(g,xx,59,7,2,p.trim);pixel(g,xx+3,61,p.timber);
    }
    rect(g,11,69,13,7,p.timber);rect(g,12,67,11,3,p.accent);
    rect(g,78,69,14,7,p.timber);rect(g,79,67,12,3,p.roof2);
    pixel(g,15,65,'#e8d4aa');pixel(g,82,65,'#e8d4aa');
  } else if(style==='tavern'){
    // Hanging sign and balcony rails distinguish the inn from a generic house.
    rect(g,68,33,3,13,p.timber);rect(g,64,37,12,7,p.timber);
    rect(g,65,38,10,5,p.accent);pixel(g,69,39,p.trim);
    rect(g,30,42,44,2,p.timber);rect(g,32,39,2,4,p.trim);rect(g,70,39,2,4,p.trim);
    for(let xx=35;xx<70;xx+=8) rect(g,xx,42,2,5,p.timber);
  } else {
    // Residential flower boxes, stacked firewood and a visible doorstep.
    rect(g,17,64,14,3,p.timber);rect(g,18,65,12,2,p.accent);
    for(let xx=19;xx<29;xx+=3){pixel(g,xx,63,'#7eaa69');pixel(g,xx+1,62,'#d5a5bf');}
    rect(g,76,65,10,5,p.timber);rect(g,77,63,8,2,p.stone);
    for(let xx=78;xx<85;xx+=3) rect(g,xx,64,2,4,p.accent);
  }
  // Moss and small grass tufts at the base break the hard cutout edge.
  for(let xx=10;xx<95;xx+=11){
    pixel(g,xx,81,'#71864a');pixel(g,xx+1,80,'#9aab66');
    if(xx%3===0) pixel(g,xx+3,82,'#d5bd70');
  }

  // Individual stone chips, moss and timber pegs; all aligned to the pixel grid.
  for(let i=0;i<16;i++){const x=9+(i*29)%86,y=73+(i*7)%9;pixel(g,x,y,i%3===0?p.accent:p.stone);}
  return c;
}
export function drawAuroraBuilding(ctx,x,y,style='home',variant='default'){
  if(!ctx||typeof document==='undefined') return false;
  const key=PALETTES[style]?style:'home';
  const cacheKey=key==='home'&&variant==='home-se'?'home:home-se':key;
  if(!cache.has(cacheKey)) cache.set(cacheKey,makeBuilding(key,variant));
  ctx.save();
  try {
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(cache.get(cacheKey),Math.round(x-W*SCALE/2),Math.round(y-H*SCALE+8),W*SCALE,H*SCALE);
    return true;
  } finally {
    ctx.restore();
  }
}
