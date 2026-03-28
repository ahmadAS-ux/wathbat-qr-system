import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

export default function NotFound() {
  const { t } = useLanguage();

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md px-4">
        <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-8">
          <FileQuestion className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-4xl font-bold text-foreground">404</h1>
        <p className="text-lg text-muted-foreground">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="pt-4">
          <Link href="/">
            <Button size="lg" className="rounded-full px-8">
              Return Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
