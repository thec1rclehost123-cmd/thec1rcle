import { notFound } from "next/navigation";

export default async function InterviewDynamicPage({ params }) {
  await params;
  notFound();
}
