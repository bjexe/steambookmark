// @ts-nocheck
// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";

const key = process.env.STEAM_API_KEY;

function createURL(ids: [number]): string {
  let url: string = `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${key}&steamids=`;
  let delimitedIds: string = "";
  ids.forEach((id) => {
    delimitedIds = delimitedIds.concat(String(id), ",");
  });
  return url.concat(delimitedIds);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const body = JSON.parse(req.body);
  const ids = body.ids;
  if (ids === null || ids.length < 1) {
    res.status(400).json({ error: "supply at least 1 steam id" });
  }
  const rounds = Math.floor((body.ids.length - 1) / 100) + 1;
  let data;
  for (let i = 0; i < rounds; i++) {
    const url = createURL(body.ids.slice(i * 100, i * 100 + 100));
    let steamResult = await (await fetch(url)).json();
    console.log(`steamResult: ${JSON.stringify(steamResult, null, 2)}`);
    if (i === 0) data = steamResult.response;
    else data.players = data.players.concat(steamResult.response.players);
  }
  console.log(`data from getPlayerDetails: ${JSON.stringify(data, null, 2)}`);
  res.status(200).json({ data: data.players });
}
