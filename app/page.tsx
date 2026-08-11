import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MINI Racer",
  description: "빨간 미니 스포츠카로 장난감 장애물을 피하는 모바일 레이싱 게임",
};

export default function Home() {
  return (
    <main className="game-shell">
      <iframe
        className="game-frame"
        src="/game.html"
        title="MINI Racer 게임"
        allow="autoplay"
      />
    </main>
  );
}
