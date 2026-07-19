/**
 * Seed template_categories for the gallery (niches + creators).
 *
 * Usage (from apps/generation-worker):
 *   pnpm db:seed:categories
 *
 * Requires DATABASE_URL (loads .env via dotenv).
 * Re-runs upsert name/description/sortOrder; does not overwrite existing `active` flags.
 */
import "dotenv/config";
import { createPrismaClient } from "../src/db/index.js";

type CategorySeed = {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
};

/**
 * Gallery sections: content niches people follow, plus a Creators bucket
 * for templates cloned from real creator thumbnails.
 */
const CATEGORIES: CategorySeed[] = [
  {
    slug: "creators",
    name: "Creators",
    description:
      "Browse templates inspired by popular creators — pick a look, then make it yours.",
    sortOrder: 0,
  },
  {
    slug: "gaming",
    name: "Gaming",
    description: "High-energy game, stream, and esports thumbnails.",
    sortOrder: 1,
  },
  {
    slug: "tech",
    name: "Tech",
    description: "Gadgets, reviews, software, and AI explainers.",
    sortOrder: 2,
  },
  {
    slug: "finance",
    name: "Finance",
    description: "Money, investing, and business covers that convert clicks.",
    sortOrder: 3,
  },
  {
    slug: "education",
    name: "Education",
    description: "Tutorials, courses, and how-to thumbnails.",
    sortOrder: 4,
  },
  {
    slug: "podcast",
    name: "Podcast",
    description: "Episode and interview covers for audio shows.",
    sortOrder: 5,
  },
  {
    slug: "fitness",
    name: "Fitness",
    description: "Workout, health, and transformation thumbnails.",
    sortOrder: 6,
  },
  {
    slug: "vlog",
    name: "Vlog",
    description: "Lifestyle, daily, and personal story covers.",
    sortOrder: 7,
  },
  {
    slug: "food",
    name: "Food",
    description: "Recipes, reviews, and kitchen content.",
    sortOrder: 8,
  },
  {
    slug: "sports",
    name: "Sports",
    description: "Highlights, analysis, and fan content.",
    sortOrder: 9,
  },
  {
    slug: "music",
    name: "Music",
    description: "Releases, covers, and performance thumbnails.",
    sortOrder: 10,
  },
  {
    slug: "entertainment",
    name: "Entertainment",
    description: "Movies, reactions, and pop-culture covers.",
    sortOrder: 11,
  },
  {
    slug: "travel",
    name: "Travel",
    description: "Destinations, guides, and adventure thumbnails.",
    sortOrder: 12,
  },
  {
    slug: "business",
    name: "Business",
    description: "Startups, marketing, and professional content.",
    sortOrder: 13,
  },
];

async function main() {
  const prisma = createPrismaClient();

  try {
    let created = 0;
    let updated = 0;

    for (const entry of CATEGORIES) {
      const data = {
        name: entry.name,
        description: entry.description,
        sortOrder: entry.sortOrder,
      };

      const existing = await prisma.templateCategory.findUnique({
        where: { slug: entry.slug },
      });

      if (existing) {
        await prisma.templateCategory.update({
          where: { slug: entry.slug },
          data,
        });
        updated += 1;
        console.log(`updated  ${entry.slug}`);
      } else {
        await prisma.templateCategory.create({
          data: {
            ...data,
            slug: entry.slug,
            active: true,
          },
        });
        created += 1;
        console.log(`created  ${entry.slug}`);
      }
    }

    console.log(
      `\nDone. created=${created} updated=${updated} total=${CATEGORIES.length}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
