import { createBloggerPostPayload } from "../integrations/bloggerService.js";
import { buildArticleUrl } from "../seo/seoInfrastructure.js";

export function prepareBloggerPublish({
  article,
  seo,
  gate
}) {
  if (!article || !seo || !gate) {
    throw new Error("Article, SEO and gate are required.");
  }

  if (!gate.publishAllowed) {
    return {
      status: "BLOCKED",
      reason: "Final publish gate did not approve content."
    };
  }

  const payload = createBloggerPostPayload({
    article,
    seo,
    source: article.source
  });

  return {
    status: "READY_TO_PUBLISH",
    articleUrl: buildArticleUrl(seo.slug),
    payload
  };
}
