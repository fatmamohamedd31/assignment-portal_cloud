import { useEffect, useRef } from 'react';
// Cloudflare Turnstile widget (external API). Calls onToken(token) when the check passes.
export default function Turnstile({ onToken }) {
 const box = useRef(null);
 useEffect(() => {
 const draw = () => window.turnstile && window.turnstile.render(box.current, {
 sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA',
 callback: onToken, 'expired-callback': () => onToken('')
 });
 if (window.turnstile) draw();
 else {
 const s = document.createElement('script');
 s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
 s.async = true; s.onload = draw; document.head.appendChild(s);
 }
 }, []);
 return <div ref={box} style={{ margin: '10px 0' }} />;
}