/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { fallbackDirections } = require('../lib/studio/director.ts');
const { roomStudioConfigSchema } = require('../lib/studio/contracts.ts');
const { fetchAndCacheResource } = require('../lib/browser-cache/cache.ts');
const { openCacheIndexDb } = require('../lib/browser-cache/db.ts');

test('three fallback styles preserve every medium and differ in pacing and beat response', () => {
  const selectedMedia = ['photo-a','photo-b','video'].map((mediaId,order)=>({mediaId,order,volume:1,trimInSec:null,trimOutSec:null,loop:false,fit:'contain'}));
  const studio = roomStudioConfigSchema.parse({schemaVersion:1,selectedMedia,sectionPlan:[{id:'section_album',type:'photo-slide',mediaIds:['photo-a','photo-b'],order:0},{id:'section_video',type:'video',mediaIds:['video'],order:1}],storyAnchors:{opening:[],climax:['video'],ending:[]},storyAnchorsConfirmed:true,themeId:'theme_warm_memory',backgroundMusic:{source:'catalog',songId:'song_afterglow'},directionCandidates:[],selectedDirectionId:null,updatedAt:'2026-10-08T00:00:00.000Z'});
  const choices = fallbackDirections({roomId:'qa',recipientName:'QA',occasionId:'birthday',studio,media:selectedMedia.map(item=>({id:item.mediaId,type:item.mediaId==='video'?'video':'photo'})),submissions:[],roomMusic:null,variantCount:3});
  assert.equal(choices.length,3);
  assert.equal(new Set(choices.map(item=>item.sections[1].dwellSeconds)).size,3);
  assert.equal(new Set(choices.map(item=>item.sections[1].beatAlignment)).size,3);
  for (const choice of choices) {
    assert.deepEqual(choice.sections.flatMap(item=>item.mediaIds),['photo-a','photo-b','video']);
    assert.equal(choice.sections[2].role,'emotional_peak');
    assert.equal(choice.generationMode,'fallback');
  }
});

test('denied browser storage still delivers media from the network', async()=>{
  const previousFetch=global.fetch;
  let requests=0;
  global.fetch=async()=>{requests++;return new Response('photo',{headers:{'content-type':'image/png','content-length':'5'}});};
  try {
    const result=await fetchAndCacheResource({cacheKey:'qa',sourceUrl:'https://example.com/qa',kind:'photo',resourceId:'qa'});
    assert.equal(result.source,'network'); assert.equal(await result.response.text(),'photo'); assert.equal(requests,1);
  } finally {global.fetch=previousFetch;}
});

test('blocked IndexedDB upgrades reject instead of hanging the media loader', async()=>{
  const previous=global.indexedDB;
  global.indexedDB={open:()=>{const request={};queueMicrotask(()=>request.onblocked());return request;}};
  try {await assert.rejects(openCacheIndexDb(),/Penyimpanan lokal/);} finally {if(previous)global.indexedDB=previous;else delete global.indexedDB;}
});
