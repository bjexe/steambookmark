// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";

const key = process.env.STEAM_API_KEY;

type Data = {
  id?: string;
  error?: string;
};

function detectURL(data: string): boolean {
  if (
    /^(http(s):\/\/.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/g.test(
      data
    )
  ) {
    return true;
  } else {
    return false;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const body = JSON.parse(req.body);
  console.log(req.body);
  if(!body.id){
    res.status(400).json({error: 'empty body'})
  }
  let input = body.id;
  if (input.slice(-1) === "/") input = input.slice(0, -1);
  let vanityId = "";
  if (detectURL(input)) {
    if (
      input.slice(0, 36).includes("profiles") &&
      !input.slice(0, 30).includes("id")
    ) {
      const id_from_link = input.slice(36);
      if (id_from_link.length == 17) {
        res.status(200).json({ id: input.slice(36) });
      } else {
        res.status(400).json({ error: "malformed community profile link" });
      }
    } else if (input.slice(0, 30).includes("id")) {
      vanityId = input.slice(30);
    } else {
      res.status(400).json({ error: "malformed community profile link" });
    }
  } else {
    vanityId = input;
  }
  const response = await (
    await fetch(
      `http://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${key}&vanityurl=${vanityId}`
    )
  ).json();
  console.log(`found: ${JSON.stringify(response)}`);
  res.status(200).json({ id: response.response.steamid });
}
