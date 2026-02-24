import { Job } from "./types";

const HF_API_KEY = import.meta.env.VITE_HF_KEY;

export async function queryJobContextHF(
  job: Job,
  userQuestion: string
): Promise<string> {

  try {
    const response = await fetch("http://127.0.0.1:8000/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jobTitle: job.title,
        jobDescription:
          job.jobSummary + "\n" + job.responsibilities.join("\n"),
        question: userQuestion,
        history: []
      })
    });

    const data = await response.json();
    return data.answer || "No response generated.";

  } catch (error) {
    console.error(error);
    return "AI service temporarily unavailable.";
  }
}
