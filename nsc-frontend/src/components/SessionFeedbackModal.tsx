import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";

interface SessionFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (rating: number, feedbackText: string) => void;
  onSkip: () => void;
  sessionId: string;
}

export function SessionFeedbackModal({ open, onOpenChange, onSubmit, onSkip, sessionId }: SessionFeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxChars = 500;
  const remainingChars = maxChars - feedbackText.length;

  const handleSubmit = async () => {
    if (rating === 0) {
      return; // Require at least a rating
    }

    setIsSubmitting(true);
    try {
      await onSubmit(rating, feedbackText);
      // Reset state
      setRating(0);
      setHoveredRating(0);
      setFeedbackText("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    // Reset state
    setRating(0);
    setHoveredRating(0);
    setFeedbackText("");
    onSkip();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Session Feedback</DialogTitle>
          <DialogDescription className="text-slate-400">
            How was your session experience? Your feedback helps us improve.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300">
              Rate your experience <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
                  aria-label={`Rate ${star} stars`}
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${
                      star <= (hoveredRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-slate-600 hover:text-slate-500"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-cyan-400 animate-in fade-in duration-200">
                {rating === 1 && "Poor"}
                {rating === 2 && "Fair"}
                {rating === 3 && "Good"}
                {rating === 4 && "Very Good"}
                {rating === 5 && "Excellent"}
              </p>
            )}
          </div>

          {/* Feedback Text */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300">
              Additional comments <span className="text-slate-500">(optional)</span>
            </label>
            <Textarea
              value={feedbackText}
              onChange={(e) => {
                const text = e.target.value;
                if (text.length <= maxChars) {
                  setFeedbackText(text);
                }
              }}
              placeholder="Share your thoughts about the session..."
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 min-h-[120px] resize-none focus:ring-cyan-500 focus:border-cyan-500"
              maxLength={maxChars}
            />
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Your feedback is valuable to us</span>
              <span className={remainingChars < 50 ? "text-amber-400" : "text-slate-500"}>
                {remainingChars} / {maxChars} characters remaining
              </span>
            </div>
          </div>

          {/* Session ID (subtle) */}
          <div className="text-xs text-slate-600">Session: {sessionId.substring(0, 8)}...</div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Skip
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
            className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white disabled:bg-slate-700 disabled:text-slate-500"
          >
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
