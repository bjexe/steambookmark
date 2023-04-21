import { useState } from "react";
import Image from "next/image";

export default function TrackedAccount({
  displayName,
  isBanned,
  todo,
  steamId,
  avatarUrl,
  trackedDate,
  untrack,
  accountId,
  inventoryValue,
}: {
  displayName: string;
  isBanned: boolean;
  todo?: [];
  steamId: string;
  avatarUrl?: string;
  trackedDate: string;
  untrack: Function;
  accountId: Number | String;
  inventoryValue: Number | String;
}) {
  let showDisplayName =
    displayName.length > 15
      ? displayName.slice(0, 15).concat("...")
      : displayName;
  const date = new Date(trackedDate)
  return (
    <div className="flex flex-row h-[75px]">
      <div className="flex flex-col w-[500px]">
        <a
          target="_blank"
          href={`http://www.steamcommunity.com/profiles/${steamId}`}
        >
          <div className="flex bg-[#1C252E] hover:drop-shadow-2xl hover: cursor-pointer">
            <Image
              alt={`steam avatar for account ${steamId}`}
              src={
                avatarUrl
                  ? avatarUrl
                  : "https://avatars.cloudflare.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg"
              }
              width={75}
              height={75}
            />
            <div className="w-[5px] bg-cyan-500" />
            <p className="text-[#34BED3] ml-[20px] self-center text-l">
              {showDisplayName}
            </p>
            <div className="ml-[35px] self-center mr-[20px]">
              <p
                className={
                  isBanned
                    ? "text-red-600 font-bold m-0"
                    : "text-green-600 font-bold"
                }
              >
                {isBanned ? "BANNED!" : "No ban"}
              </p>
              {trackedDate && <p className="m-0">Tracked: {date.toDateString()}</p>}
              {/* {inventoryValue ? <p> Inventory value: ${`${inventoryValue}`}</p> : <p>No inventory data</p>} */}
            </div>
          </div>
        </a>
      </div>
      <div className="ml-0 z-10 ml-[-25px] h-[25px]">
        <div className="flex flex-row">
            <div className="bg-red-600 hover:cursor-pointer w-[25px] text-center hover:drop-shadow-3xl" onClick={() => untrack(accountId)}>
                X
            </div>
        </div>
      </div>
    </div>
  );
}
