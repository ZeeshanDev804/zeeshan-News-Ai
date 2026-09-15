import {
  createCanonicalUrl,
  createRobotsTxt,
  createSitemapXml
} from "./seoInfrastructure.js";

export function getStaticSeoUrls() {
  return [
    createCanonicalUrl("/"),
    createCanonicalUrl("/news"),
    createCanonicalUrl("/trending"),
    createCanonicalUrl("/sports"),
    createCanonicalUrl("/entertainment"),
    createCanonicalUrl("/ai-technology"),
    createCanonicalUrl("/business"),
    createCanonicalUrl("/how-to"),
    createCanonicalUrl("/about"),
    createCanonicalUrl("/contact"),
    createCanonicalUrl("/privacy"),
    createCanonicalUrl("/terms"),
    createCanonicalUrl("/disclaimer")
  ];
}

export function buildStaticSitemap() {
  return createSitemapXml(
    getStaticSeoUrls()
  );
}

export function buildRobotsFile() {
  return createRobotsTxt();
}
