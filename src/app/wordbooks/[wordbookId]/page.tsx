import Link from "next/link";
import { WordList } from "@/components/words/word-list";

interface PageProps {
  params: { wordbookId: string };
}

export default function WordbookPage({ params }: PageProps) {
  const { wordbookId } = params;
  return (
    <div className="p-8 space-y-4">
      <Link href="/" className="text-sm text-muted-foreground">
        &larr; 返回單字本列表
      </Link>
      <h1 className="text-2xl font-bold">單字管理</h1>
      <WordList wordbookId={wordbookId} />
    </div>
  );
}
