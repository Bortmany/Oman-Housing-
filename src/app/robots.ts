import type { MetadataRoute } from "next";
import { buildRobots } from "@/lib/robotsRules";
import { getSiteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return buildRobots(getSiteUrl());
}
