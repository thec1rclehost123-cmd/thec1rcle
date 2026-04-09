import PagePlaceholder from "../../../components/PagePlaceholder";

export default async function InterviewDynamicPage({ params }) {
  const { slug } = await params;
  return (
    <div className="px-6">
      <PagePlaceholder
        title={slug.replace(/-/g, " ")}
        description="Full interview detail view will live here."
      />
    </div>
  );
}
