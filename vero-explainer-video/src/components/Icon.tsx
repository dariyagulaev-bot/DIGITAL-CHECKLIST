import { C } from '../theme';
const P: Record<string,string> = {
  check:'M5 12l4.5 4.5L19 7', shield:'M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z M9 12l2 2 4-4',
  wifi:'M2 8.8A16 16 0 0 1 22 8.8 M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 19.6v0',
  wifioff:'M2 4l18 18 M5 12.5a10 10 0 0 1 4-2.3 M19 11.8a10 10 0 0 0-4.2-2.6 M8.5 16a5 5 0 0 1 6 0',
  pen:'M14 4l6 6L9 21l-6 1 1-6z M13 5l6 6', lock:'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4',
  alert:'M12 3l9.5 17H2.5z M12 10v4 M12 17v0', file:'M7 3h7l5 5v13H7z M14 3v5h5 M9 13h6M9 16h6',
  printer:'M7 8V3h10v5 M4 8h16v8H4z M7 16h10v5H7z', bars:'M4 20V10M10 20V5M16 20v-8M22 20H2',
  download:'M12 3v12 M7 11l5 5 5-5 M4 20h16', gauge:'M4 18a8 8 0 1 1 16 0 M12 14l4-4',
  user:'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M4 21a8 8 0 0 1 16 0',
  eye:'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 12v0 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  helmet:'M4 15a8 8 0 0 1 16 0 M3 15h18v2H3z M12 7v-2 M12 5a7 7 0 0 1 4 1.6 M12 5a7 7 0 0 0-4 1.6',
  glasses:'M2 9h5l1 2 M22 9h-5l-1 2 M4 11a3 3 0 1 0 6 0 3 3 0 0 0-6 0z M14 11a3 3 0 1 0 6 0 3 3 0 0 0-6 0z M10 11h4',
  award:'M12 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10z M9 13l-1 7 4-2 4 2-1-7',
  stop:'M8 3h8l5 5v8l-5 5H8l-5-5V8z',
};
export const Icon: React.FC<{name:string;size?:number;color?:string;sw?:number}> = ({name,size=28,color=C.cyan,sw=1.9}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d={P[name]||''}/></svg>
);
