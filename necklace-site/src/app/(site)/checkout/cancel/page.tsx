import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CancelPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
        Checkout canceled
      </p>
      <h1 className="font-hand mt-6 text-4xl md:text-5xl">またのちほど。</h1>
      <p className="font-hand mt-8 max-w-md text-[16px] leading-[1.85] text-muted-foreground">
        決済はキャンセルされました。カートの内容は保存されています。
      </p>
      <div className="mt-10 flex gap-3">
        <Link href="/products">
          <Button variant="outline">買い物に戻る</Button>
        </Link>
      </div>
    </div>
  );
}
