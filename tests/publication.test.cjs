/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { Timestamp } = require('firebase-admin/firestore');
const shared = require('../lib/data/firestore/shared.ts');
const { FirestoreReceiverRepository } = require('../lib/data/firestore/firestore-receiver-repository.ts');
const { FirestoreRoomRepository } = require('../lib/data/firestore/firestore-room-repository.ts');
const { FirestoreSubmissionRepository } = require('../lib/data/firestore/firestore-submission-repository.ts');
const { submissionSchema } = require('../lib/data/contracts/submission.ts');
const { recordReceiverEvent } = require('../lib/receiver/analytics.ts');
const receiverService = require('../lib/receiver/service.ts');
// Serial transaction adapter: commit only after the callback succeeds. No Firebase writes.
function fakeDb(initial) {
  const documents = new Map(Object.entries(initial)); let pending = Promise.resolve();
  function ref(path) { return {path,id:path.split('/').pop(),collection:name=>({path:path+'/'+name,query:true,doc:id=>ref(path+'/'+name+'/'+id)}),get:async()=>snapshot(ref(path))}; }
  function snapshot(ref) { if(ref.query){const docs=[...documents.keys()].filter(key=>key.startsWith(ref.path+'/') && key.split('/').length===ref.path.split('/').length+1).map(path=>snapshot({path,id:path.split('/').pop()}));return {docs,size:docs.length};} return {id:ref.id,exists:documents.has(ref.path),data:()=>documents.get(ref.path)}; }
  const db = { documents, collection:name=>({doc:id=>ref(name+'/'+id)}), runTransaction:callback=> {
    const result = pending.then(async()=> { const writes=[]; const tx={ get:async ref=>snapshot(ref), set:(ref,value)=>writes.push([ref.path,value]), create:(ref,value)=>{if(documents.has(ref.path))throw Error('exists');writes.push([ref.path,value]);}, update:(ref,patch)=>{if(!documents.has(ref.path))throw Error('missing');writes.push([ref.path,{...documents.get(ref.path),...patch}]);} }; const value=await callback(tx);writes.forEach(([id,data])=>documents.set(id,data));return value; });
    pending=result.catch(()=>undefined);return result;
  }};return db;
}
const version='2026-10-08T12:00:00.000Z';
const manifest={schemaVersion:1,receiverId:'receiver-a',room:{id:'room',title:'QA',recipientName:'QA',occasionId:'birthday'},theme:{id:'theme',name:'Theme',palette:{background:'#000000',surface:'#222222',primary:'#ffffff',accent:'#eeeeee',text:'#ffffff',muted:'#cccccc'},typography:{displayFamily:'Georgia',bodyFamily:'Arial',displayWeight:400,bodyWeight:400,letterSpacingEm:0},backgroundAssetId:'photo',decorations:[]},assets:[{id:'photo',kind:'media',contentType:'image/png',delivery:'public',publicPath:'/qa.png',mediaId:'media'}],media:[{id:'media',assetId:'photo',type:'photo',contentType:'image/png',width:1,height:1,durationSec:null,contributorName:null,originalFileName:'qa.png'}],wishes:[{id:'wish',text:'a'.repeat(3000),contributorName:null}],music:{name:'Music',trackAssetId:'music',bpm:100,durationSec:10,mood:[],beatmapSource:'asset',beatmapAssetId:'beats',beats:[],onsets:[],energyCurve:[]},experience:{schemaVersion:1,directorVersion:'director-v1',sections:[]}};
const room=()=>({ownerUid:'owner',status:'configuring',title:'QA',recipientName:'QA',themeId:'theme',receiverId:null,config:{studio:{updatedAt:version}}});
const input=(receiverId='receiver-a')=>({roomId:'room',receiverId,manifest:{...manifest,receiverId},assets:[],bakedAt:version,expectedStudioUpdatedAt:version});

test('already published catalog music remains readable after owner-upload-only change', async () => {
 const songPath = '/creative/songs/7d89cc662f46c0c3dbf2d1d6f1e3da5da3302d64f20f246e4a09fffdd1b275bd/track.wav';
 const published = { ...manifest, revision: 1, bakedAt: Timestamp.fromDate(new Date(version)), assets: [...manifest.assets, { id:'music',kind:'music',contentType:'audio/wav',delivery:'public',publicPath:songPath,mediaId:null }], experience: { ...manifest.experience, backgroundMusic: { source:'catalog',songId:'song_afterglow' } } };
 const db = fakeDb({ 'receivers/receiver-a': published }); shared.firestoreDb = () => db;
 const result = await new FirestoreReceiverRepository().getManifest('receiver-a');
 assert.equal(result.experience.backgroundMusic.source, 'catalog');
 assert.equal(result.assets.find(asset => asset.id === 'music').publicPath, songPath);
 assert.ok(require('node:fs').existsSync(require('node:path').join(__dirname, '..', 'public', songPath)));
});
test('simultaneous first publication keeps one stable link and revision',async()=>{
 const db=fakeDb({'rooms/room':room()});shared.firestoreDb=()=>db;
 const repo=new FirestoreReceiverRepository();const [a,b]=await Promise.all([repo.publishSnapshot(input()),repo.publishSnapshot(input('receiver-b'))]);
 assert.equal(a.receiverId,b.receiverId);assert.equal(a.revision,1);assert.equal(b.revision,1);assert.equal(db.documents.has('receivers/receiver-b'),false);assert.equal(db.documents.get('rooms/room').status,'ready');
});
test('stale draft and deleting Room reject publication without status downgrade',async()=>{
 for (const state of [{...room(),config:{studio:{updatedAt:'newer'}}},{...room(),config:{studio:{updatedAt:version},_deleting:true}}]) {
  const db=fakeDb({'rooms/room':state});shared.firestoreDb=()=>db;
  await assert.rejects(new FirestoreReceiverRepository().publishSnapshot(input()));
  assert.equal(db.documents.size,1);assert.equal(db.documents.get('rooms/room').status,'configuring');
 }
});
test('publishing a revised draft increments revision while preserving URL',async()=>{
 const db=fakeDb({'rooms/room':room()});shared.firestoreDb=()=>db;const repo=new FirestoreReceiverRepository();
 await repo.publishSnapshot(input());db.documents.set('rooms/room',{...db.documents.get('rooms/room'),status:'configuring'});
 const published=await repo.publishSnapshot(input());assert.equal(published.revision,2);assert.equal(published.receiverId,'receiver-a');
});
test('stale Studio save cannot overwrite another tab or a published Room',async()=>{
 const db=fakeDb({'rooms/room':room()});shared.firestoreDb=()=>db;const repo=new FirestoreRoomRepository();
 await assert.rejects(repo.setConfig('room',{studio:{updatedAt:'new'}},version,{studio:{updatedAt:'old'}}),{code:'STUDIO_CHANGED'});
 await repo.setConfig('room',{studio:{updatedAt:'new',themeId:'updated'}},version,room().config);
 assert.equal(db.documents.get('rooms/room').themeId,'updated');
 db.documents.get('rooms/room').status='ready';await assert.rejects(repo.setConfig('room',{},version),{code:'STUDIO_CHANGED'});
});
test('repeated wish-only commit counts once and capacity checks are atomic',async()=>{
 const db=fakeDb({'rooms/room':{...room(),status:'collecting',collectionDeadline:Timestamp.fromMillis(Date.now()+60000),contributionCount:99}});shared.firestoreDb=()=>db;
 const submission=submissionSchema.parse({id:'submission',roomId:'room',mediaIds:[],stagedMedia:[],message:'QA',contributorName:'QA',source:'contributor',status:'new',submittedAt:version,reviewedAt:null});
 const repo=new FirestoreSubmissionRepository();const results=await Promise.all([repo.createPending(submission),repo.createPending(submission)]);
 assert.deepEqual(results,['created','exists']);assert.equal(db.documents.get('rooms/room').contributionCount,100);
 await assert.rejects(repo.createPending({...submission,id:'next'}),{code:'ROOM_CAPACITY'});
});
test('analytics is idempotent for retry and out-of-order engagement',async()=>{
 const db=fakeDb({'rooms/room':{...room(),receiverId:'receiver-a'}});shared.firestoreDb=()=>db;receiverService.getPublishedReceiver=async()=>({...manifest,receiverId:'receiver-a'});
 await Promise.all([recordReceiverEvent('receiver-a','viewer','watch_threshold'),recordReceiverEvent('receiver-a','viewer','open'),recordReceiverEvent('receiver-a','viewer','watch_threshold')]);
 const day=[...db.documents.entries()].find(([key])=>key.includes('/analyticsDaily/'))[1];assert.deepEqual(day,{opens:1,engaged:1});
});
test('legacy Room capacity includes contributions created before counters existed',async()=>{
 const documents={'rooms/room':{...room(),status:'collecting',collectionDeadline:Timestamp.fromMillis(Date.now()+60000)}};
 for(let i=0;i<100;i++)documents['rooms/room/submissions/old'+i]={stagedMedia:[]};
 const db=fakeDb(documents);shared.firestoreDb=()=>db;
 const next=submissionSchema.parse({id:'new',roomId:'room',mediaIds:[],stagedMedia:[],message:'QA',contributorName:'QA',source:'contributor',status:'new',submittedAt:version,reviewedAt:null});
 await assert.rejects(new FirestoreSubmissionRepository().createPending(next),{code:'ROOM_CAPACITY'});
 assert.equal(db.documents.has('rooms/room/submissions/new'),false);
});
