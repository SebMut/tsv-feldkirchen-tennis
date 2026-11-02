import { supabase } from '../lib/supabase';

/** Shared desktop, mobile-menu and mobile-dock LIVE indicator. */
export function initLiveNavPulse() {
  const links=Array.from(document.querySelectorAll<HTMLAnchorElement>('.js-live-nav-link'));
  if(!links.length) return;

  let busy=false;
  const refresh=async()=>{
    if(busy || document.visibilityState==='hidden') return;
    busy=true;
    try {
      // RLS exposes only public/published matches, never private team data.
      const {data,error}=await supabase.from('match_live_state')
        .select('match_id').eq('status','live').limit(1);
      if(error) return;
      const anyLive=(data?.length||0)>0;
      for(const link of links){
        link.classList.toggle('has-live-match',anyLive);
        if(anyLive){
          link.setAttribute('aria-label','Live-Ticker – jetzt läuft ein Spiel');
          link.setAttribute('title','Jetzt live: TSV-Spieltag');
        }else{
          link.setAttribute('aria-label','Live-Ticker');
          link.removeAttribute('title');
        }
      }
    }catch{
      // A network error must not turn an unverified game into a LIVE announcement.
    }finally{busy=false}
  };

  void refresh();
  // Keep the indicator correct without needing a manual page refresh.
  const timer=window.setInterval(()=>void refresh(),30000);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible') void refresh();
  });
  window.addEventListener('pagehide',()=>window.clearInterval(timer),{once:true});
}
