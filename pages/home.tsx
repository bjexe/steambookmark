// @ts-nocheck

import Head from "next/head";
import { useState, useEffect } from "react";
import { useUser, useSupabaseClient } from "@supabase/auth-helpers-react";
import { useRouter } from "next/router";
import TrackedAccount from "@/components/TrackedAccount";
import Notif from "@/components/Notif";
import {
  queryBans,
  queryID,
  queryPlayerDetails,
} from "@/utils/steam/steamApis";

export default function Home() {
  const [userToAdd, setUserToAdd] = useState("");
  const [note, setNote] = useState("");
  const [trackedAccounts, setTrackedAccounts] = useState([]);
  const [bannedAccounts, setBannedAccounts] = useState([]);
  const [newBans, setNewBans] = useState([]);
  const [viewingAll, setViewingAll] = useState(true);
  const [findAccountError, setFindAccountError] = useState(false);
  const [sortByLabel, setSortByLabel] = useState("Newest First");
  const [cooldownError, setCooldownError] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [foundBans, setFoundBans] = useState(false);
  const [numBansFound, setNumBansFound] = useState(0);
  const [timeToRefresh, setTimeToRefresh] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const user = useUser();
  const router = useRouter();
  const supabase = useSupabaseClient();

  useEffect(() => {
    if (!user) {
      router.push("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    getTrackedAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (trackedAccounts.length) {
      setBannedAccounts(
        trackedAccounts.filter((account) => {
          if (account.is_banned) return true;
          else return false;
        })
      );
    }
  }, [trackedAccounts]);

  // some accounts are private, consider using private data when available. currently only uses the public fields from the api
  async function sus(id: string) {
    if (findAccountError) {
      setFindAccountError(false);
    }
    const steam64id = await queryID(id).then((data) => data);
    if (!steam64id) {
      setFindAccountError(true);
      return;
    }

    // check if account is in database
    const { data: existingSteamAccountData, error: existingSteamAccountError } =
      await supabase
        .from("tracked_accounts")
        .select()
        .eq("steam_id", steam64id);

    if (existingSteamAccountData.length > 0) {
      const { data: existingJunction, error: existingJunctionError } =
        await supabase
          .from("profiles_tracked_accounts")
          .select()
          .eq("tracked_account_id", existingSteamAccountData[0].id);

      if (existingJunctionError) {
        console.log(
          `error getting existing junction: ${JSON.stringify(
            existingJunctionError,
            null,
            2
          )}`
        );
      }
      // check if account is already tracked by user
      if (existingJunction.length > 0) {
        console.log(`existing relation detected`);
        return;
      }
    }

    // add account to database if it does not exist
    if (existingSteamAccountData === null || !existingSteamAccountData.length) {
      const banData = await queryBans([steam64id]);
      const rawBanData = banData.data[0];
      const VACBans = rawBanData.NumberOfVACBans;
      const gameBans = rawBanData.NumberOfGameBans;

      const profileDetails = await queryPlayerDetails([steam64id]);
      const rawProfileDetails = profileDetails.data[0];
      const displayName = rawProfileDetails.personaname;
      const avatarUrl = rawProfileDetails.avatarfull;

      const { data: addTrackedAccountData, error: addTrackedAccountError } =
        await supabase
          .from("tracked_accounts")
          .insert({
            steam_id: steam64id,
            initial_game_bans: gameBans,
            initial_vac_bans: VACBans,
            is_banned: false,
            avatar_url: avatarUrl,
            display_name: displayName,
          })
          .select();

      if (addTrackedAccountError)
        console.log(JSON.stringify(addTrackedAccountError, null, 2));

      if (addTrackedAccountData) {
        const { error: junctionInsertError } = await supabase
          .from("profiles_tracked_accounts")
          .insert({
            profile_id: await getUserID(),
            tracked_account_id: addTrackedAccountData[0].id,
            note: note,
            date_tracked: new Date(Date.now())
              .toISOString()
              .replace("T", " ")
              .replace("Z", "")
              .concat("+00"),
          });
        if (junctionInsertError) {
          console.log(
            `Error inserting junction table: ${JSON.stringify(
              junctionInsertError
            )}`
          );
        } else {
          getTrackedAccounts();
        }
      }
    } else if (existingSteamAccountError) {
      console.log(
        `Error getting potential user from database: ${JSON.stringify(
          existingSteamAccountError,
          null,
          2
        )}`
      );
    } else {
      // add user and account to junction table
      const { error: junctionInsertError } = await supabase
        .from("profiles_tracked_accounts")
        .insert({
          profile_id: await getUserID(),
          tracked_account_id: existingSteamAccountData[0].id,
          note: note,
          date_tracked: new Date(Date.now())
            .toISOString()
            .replace("T", " ")
            .replace("Z", "")
            .concat("+00"),
        });
      if (junctionInsertError)
        console.log(
          `error adding relation: ${JSON.stringify(
            junctionInsertError,
            null,
            2
          )}`
        );
      else getTrackedAccounts();
    }
    setUserToAdd("");
    setNote("");
  }

  async function getUserID() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return user.id;
    } else {
      return "";
    }
  }

  async function getTrackedAccounts() {
    const { data } = await supabase.from("profiles").select(`
                profiles_tracked_accounts(note, tracked_account_id, date_tracked),
                tracked_accounts(id, steam_id, is_banned, ban_type, ban_date, initial_vac_bans, initial_game_bans, date_added, avatar_url, display_name, inventory_value)
            `);
    if (!data.length) {
      return;
    }
    const tracked_accounts = data[0].tracked_accounts;
    const junction = data[0].profiles_tracked_accounts;

    if (tracked_accounts === null || tracked_accounts.length < 1) return;
    else {
      const updatedAccounts = [];
      tracked_accounts.forEach((account) => {
        const matchedJunction = junction.find(
          (result) => result.tracked_account_id === account.id
        );
        updatedAccounts.push({
          ...account,
          note: matchedJunction.note,
          date_tracked: matchedJunction.date_tracked,
        });
      });
      setTrackedAccounts(updatedAccounts);
    }
  }

  function checkCooldown(date: string) {
    const dateObj = new Date(date);
    // limit refresh to once every 10 minutes
    if (Date.now() - dateObj.valueOf() < 600000) {
      setTimeToRefresh(600000 - (Date.now() - dateObj.valueOf()));
      return true;
    } else {
      return false;
    }
  }

  async function refreshTrackedAccounts() {
    const { data: lastRefreshedData, error: lastRefreshedError } =
      await supabase.from("profiles").select("last_refreshed");
    if (checkCooldown(lastRefreshedData[0].last_refreshed)) {
      setCooldownError(true);
      return;
    }
    await updatePlayerDetails();
    const { data: tracked_accounts_data } = await supabase
      .from("profiles")
      .select(
        "tracked_accounts(id, steam_id, is_banned, ban_type, ban_date, initial_vac_bans, initial_game_bans, date_added, display_name)"
      );
    const tracked_accounts = tracked_accounts_data[0].tracked_accounts;

    if (tracked_accounts === null || tracked_accounts.length < 1) return;

    const steam_ids: string[] = [];
    tracked_accounts.forEach((account) => {
      steam_ids.push(account.steam_id);
    });

    const newBanData = await queryBans(steam_ids);
    const rawNewBanData = newBanData.data;
    const needsUpdate = [];
    tracked_accounts.forEach((account) => {
      if (account.is_banned) return;
      const updated_info = rawNewBanData.find(
        (result) => result.SteamId === account.steam_id
      );
      const isVacBanned =
        updated_info.NumberOfVACBans > account.initial_vac_bans;
      const isGameBanned =
        updated_info.NumberOfGameBans > account.initial_game_bans;
      if (isVacBanned) {
        needsUpdate.push({
          ...account,
          ban_type: "VAC",
        });
      } else if (isGameBanned) {
        needsUpdate.push({
          ...account,
          ban_type: "Game",
        });
      }
    });
    if (needsUpdate.length > 0) {
      setFoundBans(true);
      setNumBansFound(needsUpdate.length);
      needsUpdate.forEach(async (account) => {
        setNewBans((old) => {
          const ret = [...old];
          ret.push(account);
          return ret;
        });
        const { error } = await supabase
          .from("tracked_accounts")
          .update({
            is_banned: true,
            ban_type: account.ban_type,
            ban_date: new Date().toISOString(),
          })
          .eq("id", account.id);
        if (error) {
          console.log(JSON.stringify(error, null, 2));
        }
      });
      getTrackedAccounts();
    }
    const { error: setRefreshError } = await supabase
      .from("profiles")
      .update({ last_refreshed: new Date().toISOString() })
      .eq("id", await getUserID());
    setRefreshSuccess(true);
    setShowNotif(true);
  }

  async function untrack(trackedAccountId) {
    const { error } = await supabase
      .from("profiles_tracked_accounts")
      .delete()
      .eq("tracked_account_id", trackedAccountId)
      .eq("profile_id", await getUserID());
    if (error) {
      console.log(
        `error deleting tracked account: ${JSON.stringify(error, null, 2)}`
      );
    } else {
      await getTrackedAccounts();
    }
  }

  async function updatePlayerDetails() {
    const steamIds = trackedAccounts.map((account) => {
      return account.steam_id;
    });
    const playerDetailsResponse = await queryPlayerDetails(steamIds);
    const playerDetails = playerDetailsResponse.data;
    trackedAccounts.forEach(async (account) => {
      const newDetails = playerDetails.find(
        (result) => account.steam_id === result.steamid
      );

      if (
        account.avatar_url === newDetails.avatarfull &&
        account.display_name === newDetails.personaname
      )
        return;

      const { error } = await supabase
        .from("tracked_accounts")
        .update({
          avatar_url: newDetails.avatarfull,
          display_name: newDetails.personaname,
        })
        .eq("steam_id", account.steam_id);
      if (error)
        console.log(
          `error updating player details: ${JSON.stringify(error, null, 2)}`
        );
    });
    await getTrackedAccounts();
  }

  function sortAccounts(accounts: Object[], decreasing: boolean = true) {
    const sortedAccounts = accounts.sort((a, b) => {
      let a_date = new Date(a.date_tracked);
      let b_date = new Date(b.date_tracked);
      if (decreasing) {
        return a_date.valueOf() > b_date.valueOf()
          ? -1
          : a_date.valueOf() < b_date.valueOf()
          ? 1
          : 0;
      } else {
        return a_date.valueOf() > b_date.valueOf()
          ? 1
          : a_date.valueOf() < b_date.valueOf()
          ? -1
          : 0;
      }
    });
    return sortedAccounts;
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      router.push("/");
    }
  }

  const sortDescending = sortByLabel === "Newest First" ? true : false;

  const sortedTrackedAccounts = sortAccounts(trackedAccounts, sortDescending);

  const allTrackedAccountsDisplay = trackedAccounts.length ? (
    sortedTrackedAccounts.map((account) => {
      return (
        <TrackedAccount
          displayName={account.display_name}
          isBanned={account.is_banned}
          steamId={account.steam_id}
          avatarUrl={account.avatar_url}
          trackedDate={account.date_tracked}
          key={account.steam_id}
          untrack={untrack}
          accountId={account.id}
        />
      );
    })
  ) : (
    <p>No accounts tracked</p>
  );

  const sortedBannedAccounts = sortAccounts(bannedAccounts, sortDescending);
  const newBansJSON = newBans.length
    ? newBans.map((account) => {
        return {
          steamID: account.steam_id,
          displayName: account.display_name
        }
      })
    : [{}];

  const bannedTrackedAccountsDisplay = bannedAccounts.length ? (
    sortedBannedAccounts.map((account) => {
      return (
        <TrackedAccount
          displayName={account.display_name}
          isBanned={account.is_banned}
          steamId={account.steam_id}
          avatarUrl={account.avatar_url}
          trackedDate={account.date_tracked}
          key={account.steam_id}
          untrack={untrack}
          accountId={account.id}
        />
      );
    })
  ) : (
    <h2 className="text-3xl h-[66.8vh]">No banned accounts</h2>
  );

  return (
    <>
      <Head>
        <title>VAC Bookmark</title>
        <meta
          name="description"
          content="A web app to bookmark suspicious Steam users and gather stats on VAC bans"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="h-[100%]">
        <div className="bg-main text-white bg-cover bg-center font-inter h-[100%]">
          <div>
            {/* Navbar */}
            <div className="flex flex-col">
              <div className="fixed z-10 left-[50%] translate-x-[-50%]">
                {showNotif && <Notif newBans={newBans.length ? true : false} banList={newBansJSON} action={() => setShowNotif(false)}/>}
              </div>
              <h1 className="text-4xl text-center font-bold mb-3 pt-3 underline">
                SteamBookmark
              </h1>
              <button
                onClick={handleSignOut}
                className="mx-auto rounded-xl p-3 bg-[#FF312E] w-[90px] active:bg-[#34BED3] hover:drop-shadow-2xl mb-12"
              >
                Sign out
              </button>
              <h1 className="text-center text-2xl underline mb-3">
                Track an account
              </h1>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sus(userToAdd);
                }}
                className="flex flex-col justify-center items-center gap-y-5"
              >
                <input
                  type="text"
                  value={userToAdd}
                  placeholder="Input SteamID or link to Steam account"
                  onChange={(e) => {
                    e.preventDefault();
                    const { value } = e.target;
                    setUserToAdd(value);
                  }}
                  className="w-[80%] rounded p-2 text-sm text-center"
                />
                <button className="rounded-xl p-3 bg-[#109648] w-[200px] self-center active:bg-[#34BED3] hover:drop-shadow-2xl mb-12">
                  Track Account
                </button>
              </form>
            </div>
            {/* body */}
            <div>
              {/* view options */}
              <div className="flex justify-center flex-col gap-y-2 mb-[20px]">
                <h1 className="text-center text-2xl underline mb-3">
                  Tracked accounts
                </h1>
                <div className="flex justify-center items-center">
                  <h2 className="text-xl">Sort by:&nbsp;</h2>
                  <div className="text-center text-[#34BED3] hover:cursor-pointer hover:drop-shadow-5xl rounded-xl p-3 bg-[#1C252E] w-[200px] self-center hover:drop-shadow-2xl">
                    <select
                      className="bg-[#1C252E] underline"
                      value={sortByLabel}
                      onChange={(e) => setSortByLabel(e.target.value)}
                    >
                      <option value="Newest First">Newest First</option>
                      <option value="Oldest First">Oldest First</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-center items-center mb-3 ">
                  <h2 className="text-xl">Show:&nbsp;</h2>
                  <h2
                    className={
                      viewingAll
                        ? "text-center text-[#34BED3] text-l underline hover:cursor-pointer hover:drop-shadow-5xl rounded-xl flex justify-center items-center bg-[#1C252E] w-[200px] self-center hover:drop-shadow-2xl h-[55px]"
                        : "text-center text-l hover:cursor-pointer hover:drop-shadow-5xl rounded-xl bg-[#1C252E] w-[200px] self-center hover:drop-shadow-2xl h-[55px] flex justify-center items-center"
                    }
                    onClick={() => setViewingAll(true)}
                  >
                    All Accounts
                  </h2>
                  <h2
                    className={
                      !viewingAll
                        ? "text-center text-[#34BED3] text-l underline hover:cursor-pointer hover:drop-shadow-5xl rounded-xl bg-[#1C252E] w-[200px] self-center hover:drop-shadow-2xl h-[55px] flex justify-center items-center"
                        : "text-center text-l hover:cursor-pointer rounded-xl bg-[#1C252E] w-[200px] self-center hover:drop-shadow-2xl h-[55px] flex justify-center items-center"
                    }
                    onClick={() => setViewingAll(false)}
                  >
                    Banned Accounts
                  </h2>
                </div>
                <button
                  className="rounded-xl p-3 bg-[#109648] w-[200px] self-center active:bg-[#34BED3] hover:drop-shadow-2xl"
                  onClick={refreshTrackedAccounts}
                >
                  Refresh Accounts
                </button>
              </div>
              {/* view results */}
              <div>
                <div className="flex flex-col gap-y-8 justify-center min-[520px]:items-center min-[800px]:flex-row min-[800px]:flex-wrap min-[800px]:gap-x-[25px]">
                  {viewingAll && allTrackedAccountsDisplay}
                  {!viewingAll && bannedTrackedAccountsDisplay}
                </div>
              </div>
            </div>
          </div>
          &nbsp;
        </div>
      </main>
    </>
  );
}
