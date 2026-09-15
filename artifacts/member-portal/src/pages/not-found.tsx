import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border border-border shadow-sm rounded">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center">
          <div className="h-16 w-16 bg-muted rounded flex items-center justify-center mb-6">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-[32px] font-bold text-ink leading-tight mb-2">Page Not Found</h1>
          <p className="text-[16px] text-muted-foreground mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link href="/dashboard" className="h-11 px-6 rounded font-semibold text-[16px] inline-flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90">
            Return to Dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
