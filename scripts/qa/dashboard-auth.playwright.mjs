// Exercises the real login form with intercepted Firebase/session responses.
// No account is created and no authentication request leaves this browser.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.DESK_QA_ORIGIN || 'http://localhost:3001';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const stamp = Math.floor(Date.now()/1000);
const token = `${b64({alg:'none',typ:'JWT'})}.${b64({sub:'desk-qa',user_id:'desk-qa',iat:stamp,exp:stamp+3600,auth_time:stamp,email:'fixture@example.invalid',firebase:{sign_in_provider:'password'}})}.fixture`;
try {
  for (const scenario of [
    { name:'dashboard', next:'/dashboard' },
    { name:'reduced', next:'/dashboard', reduced:true },
    { name:'deep-link', next:'/rooms/room_fixture/studio' },
    { name:'onboarding', next:'/rooms/room_fixture/studio', onboarding:true },
    { name:'session-error', next:'/dashboard', error:true },
  ]) {
    const context = await browser.newContext({ reducedMotion:scenario.reduced?'reduce':'no-preference' });
    const page = await context.newPage(); let sessionAt, documentAt;
    const json = (route, body, status=200) => route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    await page.route('https://identitytoolkit.googleapis.com/**', route => {
      if (route.request().url().includes('accounts:lookup')) return json(route,{users:[{localId:'desk-qa',email:'fixture@example.invalid',emailVerified:true,providerUserInfo:[{providerId:'password',federatedId:'fixture@example.invalid',email:'fixture@example.invalid'}],createdAt:String(Date.now()),lastLoginAt:String(Date.now())}]});
      return json(route,{localId:'desk-qa',email:'fixture@example.invalid',idToken:token,refreshToken:'fixture-only',expiresIn:'3600',registered:true});
    });
    await page.route('https://securetoken.googleapis.com/**', route => json(route,{access_token:token,id_token:token,expires_in:'3600',refresh_token:'fixture-only',token_type:'Bearer',user_id:'desk-qa',project_id:'fixture'}));
    await page.route('**/api/auth/csrf', route => json(route,{ok:true,data:{csrfToken:'fixture-csrf'}}));
    await page.route('**/api/auth/session', async route => {
      sessionAt = Date.now();
      await json(route, scenario.error ? {ok:false,error:{message:'Fixture session failure'}} : {ok:true,data:{needsOnboarding:Boolean(scenario.onboarding),username:'Fixture'}},scenario.error?500:200);
    });
    await page.route('**/*', async route => {
      const request=route.request(), pathname=new URL(request.url()).pathname;
      if (request.isNavigationRequest() && !pathname.startsWith('/login')) {
        documentAt=Date.now();
        return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Intercepted destination</title><h1>Fixture destination</h1>'});
      }
      return route.fallback();
    });
    await page.goto(`${origin}/login?next=${encodeURIComponent(scenario.next)}`);
    await page.getByLabel('Email',{exact:true}).fill('fixture@example.invalid');
    await page.getByLabel('Password',{exact:true}).fill('fixture-only-password');
    await page.getByRole('button',{name:'Masuk',exact:true}).click();
    if(scenario.error){
      await page.getByRole('alert').filter({hasText:'Fixture session failure'}).waitFor();
      if(await page.locator('.desk-auth-exit').count()) throw Error('Failed session must not start transition');
    }else{
      await page.getByRole('heading',{name:'Fixture destination'}).waitFor();
      const actual=new URL(page.url());
      if(actual.pathname !== (scenario.onboarding?'/onboarding':scenario.next)) throw Error(`Wrong destination: ${actual.pathname}`);
      if(scenario.onboarding && actual.searchParams.get('next')!==scenario.next) throw Error('Onboarding lost deep link');
      const hint=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('kenangin:desk-entry')||'null'));
      if(Boolean(hint) !== (scenario.name==='dashboard')) throw Error(`Incorrect arrival hint: ${scenario.name}`);
      if(documentAt-sessionAt>1500) throw Error(`Auth still blocks navigation: ${documentAt-sessionAt}ms`);
    }
    results.push({name:scenario.name,passed:true,sessionResponseToDocumentMs:documentAt?documentAt-sessionAt:null});
    console.log('PASS',results.at(-1));
    await context.close();
  }
} finally {
  await mkdir('tmp/desk-qa',{recursive:true});
  await writeFile('tmp/desk-qa/auth-report.json',JSON.stringify({scope:'Real login form; Firebase, session responses and destination HTML are mocked. Does not verify live provider/cookies.',results},null,2));
  await browser.close();
}
