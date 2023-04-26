// @ts-nocheck
// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";

const key = process.env.STEAM_API_KEY;

type Response = {
  players: [
    | {
        SteamId?: string;
        CommunityBanned?: boolean;
        VACBanned?: boolean;
        NumberOfVACBans?: number;
        DaysSinceLastBan?: number;
        NumberOfGameBans?: number;
        EconomyBan?: string;
      }
    | null
    | undefined
  ];
};

type Body = [
  {
    ids: [number];
  }
];

// creates a steam API url for querying steam bans
function createURL(ids: [number]): string {
  let url: string = `http://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${key}&steamids=`;
  let delimitedIds: string = "";
  ids.forEach((id, index) => {
    delimitedIds = delimitedIds.concat(String(id), ",");
  });
  return url.concat(delimitedIds);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const body = JSON.parse(req.body);
  let steamResult: Response;
  let data: Response = { players: [null] };
  // steam api only allows 100 steam 64 ids to be queried at once, so we need to do batches of 100
  const rounds = Math.floor((body.ids.length - 1) / 100) + 1;
  for (let i = 0; i < rounds; i++) {
    const url = createURL(body.ids.slice(i * 100, i * 100 + 100));
    steamResult = await (await fetch(url)).json();
    if (i === 0) data = steamResult;
    else data.players = data.players.concat(steamResult.players);
  }
  res.status(200).json({ data: data.players });
}
