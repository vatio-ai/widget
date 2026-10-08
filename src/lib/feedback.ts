// The feedback moment as @vatio-ai/sdk delivers it (the `feedback` event),
// in the subset of fields the widget draws.
export type FeedbackRating = "good" | "neutral" | "bad";
export interface VisitorFeedback {
  agentName: string;
  messageId: number;
  question?: string | null;
  rating: FeedbackRating | null;
  submittedAt: string | null;
  dismissed: boolean;
}
