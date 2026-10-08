import { useState } from "react";
import type { Copy } from "../lib/copy";
import type { FeedbackRating, VisitorFeedback } from "../lib/feedback";

export function Feedback({ feedback, copy, onSubmit }: {
  feedback: VisitorFeedback;
  copy: Copy;
  onSubmit: (body: { rating?: FeedbackRating; comment?: string; dismiss?: boolean }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(Boolean(feedback.submittedAt));
  const question = feedback.question || copy.feedbackQuestion.replace("{name}", feedback.agentName);

  async function save(body: { rating?: FeedbackRating; comment?: string; dismiss?: boolean }) {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await onSubmit(body);
      if (body.comment !== undefined || body.rating === "good") setDone(true);
    } catch { setError(true); }
    finally { setBusy(false); }
  }

  return <section className="feedback" aria-label={question}>
    {!feedback.rating ? <>
      <p>{question}</p>
      <div className="feedback-actions">
        {([["good", "👍", copy.feedbackGood], ["neutral", "😐", copy.feedbackNeutral], ["bad", "👎", copy.feedbackBad]] as const).map(([rating, icon, label]) =>
          <button type="button" disabled={busy} onClick={() => void save({ rating })}>{icon} {label}</button>
        )}
      </div>
      <button className="feedback-skip" type="button" disabled={busy} onClick={() => void save({ dismiss: true })}>{copy.feedbackSkip}</button>
    </> : <>
      <p role="status">{copy.feedbackThanks}</p>
      {!done && feedback.rating !== "good" ? <form onSubmit={(event) => {
        event.preventDefault();
        void save({ rating: feedback.rating!, comment });
      }}>
        <textarea aria-label={copy.feedbackComment} placeholder={copy.feedbackComment} maxLength={2000} value={comment}
          onChange={(event) => setComment(event.currentTarget.value)} disabled={busy} />
        <div className="feedback-actions">
          <button type="submit" disabled={busy}>{copy.send}</button>
          <button type="button" disabled={busy} onClick={() => setDone(true)}>{copy.feedbackSkip}</button>
        </div>
      </form> : null}
    </>}
    {error ? <p role="alert">{copy.feedbackError}</p> : null}
  </section>;
}
