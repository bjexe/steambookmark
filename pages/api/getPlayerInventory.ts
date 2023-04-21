// @ts-nocheck
// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const body = JSON.parse(req.body);
  const id = body.steam_id;
  let steamResult = await(
    await fetch(
      `https://steamcommunity.com/inventory/${id}/730/2?l=english`
    )
  ).json();
  console.log(JSON.stringify(steamResult, null, 2));
  if(steamResult === null){
    res.status(502).json({inventory: null, error: "Steam returned null"})
  }
  res.status(200).json({inventory: steamResult, error: null})
}
