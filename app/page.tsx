import { cookies } from 'next/headers';
import Workspace from '../components/workspace';
import Login from '../components/login';
import { isProductionAuthConfigured, isVercelReadOnly, sessionActor, AUTH_COOKIE } from '../lib/auth';
export const dynamic = 'force-dynamic';
export default async function Page(){
 if(process.env.PANAKO_LOCAL_MODE==='true' && process.env.NODE_ENV!=='production') return <Workspace/>;
 if(isVercelReadOnly()) return <Workspace/>;
 if(!isProductionAuthConfigured()) return <main className="auth-shell"><section className="auth-card"><div className="eyebrow">PANAKO INTELLIGENCE</div><h1>Deployment not configured</h1><p>Production authentication is not configured. The application is intentionally unavailable until the administrator adds the required server-side secrets.</p></section></main>;
 const token=(await cookies()).get(AUTH_COOKIE)?.value;
 return sessionActor(token)?<Workspace/>:<Login/>;
}
