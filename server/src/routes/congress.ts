import { Router } from 'express';

// House/Senate Stock Watcher (the free structured congress-trades source) is dead: the S3
// buckets return AccessDenied and both watcher sites are offline. Their GitHub data mirror is
// abandoned too (last commit 2021, data stops in 2019). There is currently no free, reliable,
// structured source for this data — Quiver Quantitative has one but it's a paid API, and
// Capitol Trades has no official API at all. Rather than fake it, this endpoint says so and
// links to the real official filing search tools.
export function congressRouter(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      available: false,
      reason:
        'No reliable free structured API for US congressional trade data currently exists. ' +
        'House/Senate Stock Watcher (data source previously used by many trackers) has shut down.',
      officialSources: [
        {
          label: 'Senate Financial Disclosures (eFD)',
          url: 'https://efdsearch.senate.gov',
        },
        {
          label: 'House Financial Disclosures',
          url: 'https://disclosures.house.gov',
        },
      ],
    });
  });

  return router;
}
