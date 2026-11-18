import { useEffect, useRef } from 'react';
import gameHtml from './game.html?raw';
import { initGame } from './game';
import './game.css';

let started = false;

export function App() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // StrictMode 의 이중 실행에도 게임은 한 번만 띄운다.
    if (started || !ref.current) return;
    started = true;
    initGame();
  }, []);

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: gameHtml }} />;
}
