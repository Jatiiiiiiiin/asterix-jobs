// ============================================================
// PATCH: CandidateDashboard.tsx  — auto-apply Firestore write
// Replace the existing auto-apply block inside performSemanticSync
// ============================================================

// 1. ADD this import at the top of CandidateDashboard.tsx:
import { saveApplication, buildApplicationPayload, hasApplied } from "./applicationService";

// 2. REPLACE this block inside performSemanticSync:
//
//   if (autoPilotRef.current && score >= 65 && !alreadyApplied) {
//     shouldAutoApply = true;
//     autoAppliedCount++;
//     addNotification("Auto-Applied", `${job.title} (${score}%)`, "success");
//   }
//
// WITH:

if (autoPilotRef.current && score >= 65 && !alreadyApplied) {
  // Dedup check against Firestore before writing
  const user = await authService.getCurrentUser();
  const alreadyInFirestore = user
    ? await hasApplied(user.uid, job.id)
    : false;

  if (!alreadyInFirestore && user) {
    const payload = buildApplicationPayload(user.uid, job, score, true);
    await saveApplication(payload);

    shouldAutoApply = true;
    autoAppliedCount++;

    addNotification(
      "Auto-Applied",
      `${job.title} (${score}%)`,
      "success"
    );
  }
}


// ============================================================
// PATCH: Manual apply (JobDetailPage or wherever Apply is called)
// ============================================================

// When the user clicks the manual "Apply" / "Initialize Audit" button,
// call this to persist to Firestore:

import { saveApplication, buildApplicationPayload, hasApplied } from "../applicationService";

const handleManualApply = async (job: Job, matchScore: number) => {
  const user = await authService.getCurrentUser();
  if (!user) return;

  const already = await hasApplied(user.uid, job.id);
  if (already) {
    // Already applied — update local UI only
    return;
  }

  const payload = buildApplicationPayload(user.uid, job, matchScore, false);
  await saveApplication(payload);
};


// ============================================================
// PATCH: Recruiter-side stage update (RecruiterDashboard / admin)
// Call this when a recruiter opens, reviews, or schedules an interview
// ============================================================

import { updateApplicationStage } from "../applicationService";

// Move to "reviewing" with recruiter attribution:
await updateApplicationStage(applicationId, "reviewing", {
  recruiterName: "Sarah Chen",
  recruiterTitle: "Technical Recruiter",
  lastActivity: "Profile opened for review",
});

// Move to "interview":
await updateApplicationStage(applicationId, "interview", {
  lastActivity: "Interview scheduled for Feb 20",
  notes: "Technical round + culture fit",
});

// Move to "offer":
await updateApplicationStage(applicationId, "offer", {
  lastActivity: "Offer letter sent",
});

// Move to "rejected":
await updateApplicationStage(applicationId, "rejected", {
  lastActivity: "Position filled internally",
});
