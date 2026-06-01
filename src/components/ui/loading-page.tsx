import { LoadingSpinner } from "./loading-spinner";

interface LoadingPageProps {
  message?: string;
  submessage?: string;
}

export function LoadingPage({ message, submessage }: LoadingPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <LoadingSpinner size="lg" text={submessage} />
    </div>
  );
}
