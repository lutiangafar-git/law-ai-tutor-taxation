/**
 * Basic monitoring: one JSON line per tutor call, visible in Vercel → Logs.
 * Never log student answers, topics' model answers, or secrets.
 */
export type TutorLogEvent = {
  event: "tutor_call" | "tutor_error";
  feature?: string;
  model?: string;
  ms?: number;
  outcome?: string;
};

export function logTutorEvent(entry: TutorLogEvent): void {
  console.log(JSON.stringify({ app: "law-ai-tutor", at: new Date().toISOString(), ...entry }));
}
