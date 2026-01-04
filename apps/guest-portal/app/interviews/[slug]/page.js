import PagePlaceholder from "../../../components/PagePlaceholder";

export default function InterviewDynamicPage({ params }) {
  return (
    <div className="px-6">
      <PagePlaceholder
        title={params.slug.replace(/-/g, " ")}
        description="Full interview detail view will live here."
      />
    </div>
  );
}
