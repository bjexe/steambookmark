export default function Notif({
  action,
  newBans,
  banList,
}: {
  action: Function;
  newBans: boolean;
  banList?: { displayName: string; steamID: string }[];
}) {
  const greenOuterClass =
    "flex flex-col rounded-3xl bg-[#386150] w-[250px] h-[250px] font-semibold";
  const redOuterClass =
    "flex flex-col rounded-3xl bg-red-200 w-[250px] h-[250px] font-semibold";
  const banLinks = banList?.length
    ? banList?.map((bannedAccount) => {
        return (
          <a
            target="_blank"
            className="hover:text-purple-600 text-blue-600"
            href={`http://www.steamcommunity.com/profiles/${bannedAccount.steamID}`}
            key={bannedAccount.steamID}
          >
            {bannedAccount.displayName}
          </a>
        );
      })
    : "";
  const body = newBans
    ? "flex flex-col text-center justify-center mx-2"
    : "flex flex-col text-center justify-center mx-2 mt-14";
  return (
    <div className={newBans ? redOuterClass : greenOuterClass}>
      <div
        onClick={() => action()}
        className="w-[25px] self-end hover:cursor-pointer bg-red-500 text-center rounded mb-[20px] justify-self-start"
      >
        <p>X</p>
      </div>
      <div className={body}>
        <p className="">
          {newBans
            ? `Found ${banList?.length} new bans. The following accounts were banned:`
            : "No new bans found."}
        </p>
        &nbsp;
        {newBans && banLinks}
      </div>
    </div>
  );
}
