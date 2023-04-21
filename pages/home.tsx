import Head from "next/head";
import { useState, useEffect } from "react";
import { useUser, useSupabaseClient } from "@supabase/auth-helpers-react";
import { useRouter } from "next/router";
import TrackedAccount from "@/components/TrackedAccount";
// const prices = require("@/data/prices_v6.json"); // for tracking inventory values

export default function Home() {
  const [userToAdd, setUserToAdd] = useState("");
  const [note, setNote] = useState("");
  const [trackedAccounts, setTrackedAccounts] = useState([]);
  const [bannedAccounts, setBannedAccounts] = useState([]);
  const [viewingAll, setViewingAll] = useState(true);
  const [findAccountError, setFindAccountError] = useState(false);
  const [sortByLabel, setSortByLabel] = useState("Newest First");
  const [cooldownError, setCooldownError] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [foundBans, setFoundBans] = useState(false);
  const [numBansFound, setNumBansFound] = useState(0);
  const [timeToRefresh, setTimeToRefresh] = useState(0);
  const user = useUser();
  const router = useRouter();
  const supabase = useSupabaseClient();

  useEffect(() => {
    if (!user) {
      router.push("/");
    }
  }, [user]);

  useEffect(() => {
    getTrackedAccounts();
  }, []);

  useEffect(() => {
    if (cooldownError) {
      setTimeout(() => {
        setCooldownError(false);
      }, 5000);
    }
  }, [cooldownError]);

  useEffect(() => {
    if (refreshSuccess) {
      setTimeout(() => {
        setRefreshSuccess(false);
      }, 5000);
    }
  }, [refreshSuccess]);

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

  async function queryBans(ids: string[]) {
    const sendQuery = async () => {
      const response = await fetch("/api/queryBans", {
        method: "POST",
        body: JSON.stringify({ ids: ids }),
      });
      return response.json();
    };
    const data = await sendQuery().then((data) => data);
    return data;
  }

  async function queryID(body: string) {
    let result;
    const sendQuery = async () => {
      const response = await fetch("/api/resolveSteam64ID", {
        method: "POST",
        body: JSON.stringify({ id: body }),
      });
      return response.json();
    };
    result = await sendQuery().then((data) => data.id);
    return result;
  }

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

      const inventoryValue = await getInventoryValue(steam64id);

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
            inventory_value: inventoryValue,
          })
          .select();

      if (addTrackedAccountError)
        console.log(JSON.stringify(addTrackedAccountError, null, 2));
      else
        console.log(`added steam user [${steam64id}] to tracked_users table`);

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
      console.log(timeToRefresh);
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
        "tracked_accounts(id, steam_id, is_banned, ban_type, ban_date, initial_vac_bans, initial_game_bans, date_added)"
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
        } else {
          console.log(`updated account ${JSON.stringify(account, null, 2)}`);
        }
      });
      getTrackedAccounts();
    } else {
      console.log("needsUpdate is empty");
    }
    const { error: setRefreshError } = await supabase
      .from("profiles")
      .update({ last_refreshed: new Date().toISOString() })
      .eq("id", await getUserID());
    console.log(JSON.stringify(setRefreshError, null, 2));
    setRefreshSuccess(true);
  }

  // works, sometimes. Steam inventory API is heavily rate limited on IP
  // async function refreshTrackedAccountsWithInventory() {
  //   await updatePlayerDetails();
  //   const { data: tracked_accounts_data } = await supabase
  //     .from("profiles")
  //     .select(
  //       "tracked_accounts(id, steam_id, is_banned, ban_type, ban_date, initial_vac_bans, initial_game_bans, date_added)"
  //     );
  //   const tracked_accounts = tracked_accounts_data[0].tracked_accounts;

  //   if (tracked_accounts === null || tracked_accounts.length < 1) return;

  //   const steam_ids: string[] = [];
  //   tracked_accounts.forEach((account) => {
  //     steam_ids.push(account.steam_id);
  //   });

  //   const newBanData = await queryBans(steam_ids);
  //   const rawNewBanData = newBanData.data;

  //   const needsUpdate = [];
  //   const needsUpdatePromise = new Promise(async () => {
  //     await tracked_accounts.forEach(async (account) => {
  //       let updated_info = rawNewBanData.find(
  //         (result) => result.SteamId === account.steam_id
  //       );
  //       const inventoryValue = await getInventoryValue(account.steam_id);
  //       const inventoryNeedsUpdate =
  //         inventoryValue !== null &&
  //         inventoryValue > -1 &&
  //         inventoryValue !== account.inventory_value;
  //       const isVacBanned =
  //         updated_info.NumberOfVACBans > account.initial_vac_bans;
  //       const isGameBanned =
  //         updated_info.NumberOfGameBans > account.initial_game_bans;

  //       if (inventoryNeedsUpdate) {
  //         if (isVacBanned) {
  //           needsUpdate.push({
  //             ...account,
  //             ban_type: "VAC",
  //             is_banned: true,
  //             ban_date: new Date().toISOString(),
  //             inventory_value: inventoryValue,
  //           });
  //         } else if (isGameBanned) {
  //           needsUpdate.push({
  //             ...account,
  //             ban_type: "Game",
  //             ban_date: new Date().toISOString(),
  //             is_banned: true,
  //             inventory_value: inventoryValue,
  //           });
  //         } else {
  //           console.log(`updating inventory value for ${account.steam_id}`);
  //           needsUpdate.push({
  //             ...account,
  //             inventory_value: inventoryValue,
  //           });
  //         }
  //       } else if (isVacBanned) {
  //         needsUpdate.push({
  //           ...account,
  //           ban_type: "VAC",
  //           is_banned: true,
  //           ban_date: new Date().toISOString(),
  //         });
  //       } else if (isGameBanned) {
  //         needsUpdate.push({
  //           ...account,
  //           ban_type: "Game",
  //           is_banned: true,
  //           ban_date: new Date().toISOString(),
  //         });
  //       }
  //     });
  //   });
  //   needsUpdatePromise.then(() => {
  //     console.log(JSON.stringify(needsUpdate, null, 2));
  //     if (needsUpdate.length > 0) {
  //       needsUpdate.forEach(async (account) => {
  //         const { error } = await supabase
  //           .from("tracked_accounts")
  //           .update({
  //             ...account,
  //           })
  //           .eq("id", account.id);
  //         if (error) {
  //           console.log(JSON.stringify(error, null, 2));
  //         } else {
  //           console.log(`updated account ${JSON.stringify(account, null, 2)}`);
  //         }
  //       });
  //       getTrackedAccounts();
  //     } else {
  //       console.log("needsUpdate is empty");
  //     }
  //   });
  //   // if (needsUpdate.length > 0) {
  //   //   needsUpdate.forEach(async (account) => {
  //   //     const { error } = await supabase
  //   //       .from("tracked_accounts")
  //   //       .update({
  //   //         ban_date: new Date().toISOString(),
  //   //         ban_type: account.ban_type,
  //   //         is_banned: true,
  //   //       })
  //   //       .eq("id", account.id);
  //   //     if (error) {
  //   //       console.log(JSON.stringify(error, null, 2));
  //   //     }
  //   //   });
  //   //   getTrackedAccounts();
  //   // }
  // }

  async function queryPlayerDetails(ids: string[]) {
    const sendQuery = async () => {
      const response = await fetch("/api/getPlayerDetails", {
        method: "POST",
        body: JSON.stringify({ ids: ids }),
      });
      return response.json();
    };
    const data = await sendQuery().then((data) => data);
    return data;
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

  // heavily rate limited inventory api makes this broken
  // async function getInventoryValue(steamid: String) {
  //   const sendQuery = async () => {
  //     const response = await fetch("/api/getPlayerInventory", {
  //       method: "POST",
  //       body: JSON.stringify({ steam_id: steamid }),
  //     });
  //     return response.json();
  //   };
  //   let data = await sendQuery().then((data) => data);
  //   // console.log(JSON.stringify(data, null, 2));
  //   if (data.error) {
  //     return null;
  //   }
  //   if (data.inventory === null) {
  //     return -1; // private profile
  //   } else {
  //     let totalPrice = 0;
  //     data.inventory.descriptions.forEach((description) => {
  //       if (description.marketable !== 1) {
  //         // console.log(`${description.market_name} is not marketable`);
  //         return;
  //       }
  //       const name = description.market_name;
  //       if (prices[name]["buff163"]["starting_at"]) {
  //         totalPrice =
  //           totalPrice + prices[name]["buff163"]["starting_at"]["price"];
  //       } else if (prices[name]["steam"]["last_7d"]) {
  //         totalPrice = totalPrice + prices[name["steam"]["last_7d"]];
  //       }
  //     });
  //     console.log(`total price: ${totalPrice}`);
  //     return totalPrice;
  //   }
  // }

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
    const { error } = await supabase.auth.signOut()
    if(!error) {
      router.push('/')
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
          inventoryValue={account.inventory_value}
        />
      );
    })
  ) : (
    <p>No accounts tracked</p>
  );

  const sortedBannedAccounts = sortAccounts(bannedAccounts, sortDescending);

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
          inventoryValue={account.inventory_value}
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
      <main>
        <div className="bg-main text-white bg-scroll bg-repeat bg-cover font-inter">
          <div>
            <div className="flex justify-center flex-col items-center pt-[20px] pb-[20px]">
              <div className="flex items-center w-full">
                <div>
                  <h1 className="text-5xl font-bold justify-self-start w-[550px] text-center">
                    VacTrack
                  </h1>
                </div>
                <div className="justify-self-center">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      sus(userToAdd);
                    }}
                    className="flex flex-row items-center justify-self-end gap-x-[25px]"
                  >
                    <label className="">
                      <input
                        className="text-black ml-[25px] rounded-xl w-[80vh] text-center h-[3vh]"
                        type="text"
                        value={userToAdd}
                        onChange={(e) => {
                          e.preventDefault();
                          const { value } = e.target;
                          setUserToAdd(value);
                        }}
                        placeholder="Input link to account or Steam ID"
                      />
                    </label>
                    <button className="text-3xl rounded-xl p-3 bg-[#1C252E] w-[250px] self-center active:bg-[#34BED3] hover:drop-shadow-2xl">
                      Track Account
                    </button>
                  </form>
                </div>
                <button className="ml-[175px] text-l rounded-xl p-3 bg-[#1C252E] active:bg-[#34BED3] hover:drop-shadow-2xl" onClick={handleSignOut}>Sign Out</button>
              </div>
              {findAccountError && (
                <p className="text-red-600 text-m">
                  Hmm... looks like we can't find that account. Please check
                  your input.
                </p>
              )}
            </div>
            <hr className="m-0" />
            <div className="flex justify-evenly">
              <div className="flex gap-x-[20px]">
                <div className="text-center text-[#34BED3] text-3xl mt-[50px] hover:cursor-pointer hover:drop-shadow-5xl rounded-xl p-3 bg-[#1C252E] w-[500px] self-center mt-[25px] hover:drop-shadow-2xl">
                  Sort by:&nbsp;
                  <select
                    className="bg-[#1C252E] underline"
                    value={sortByLabel}
                    onChange={(e) => setSortByLabel(e.target.value)}
                  >
                    <option value="Newest First">Newest First</option>
                    <option value="Oldest First">Oldest First</option>
                  </select>
                </div>
                <h2
                  className={
                    viewingAll
                      ? "text-center text-[#34BED3] text-3xl mt-[50px] underline hover:cursor-pointer hover:drop-shadow-5xl rounded-xl p-3 bg-[#1C252E] w-[500px] self-center mt-[25px] hover:drop-shadow-2xl"
                      : "text-center text-3xl mt-[50px] hover:cursor-pointer hover:drop-shadow-5xl rounded-xl p-3 bg-[#1C252E] w-[500px] self-center mt-[25px] hover:drop-shadow-2xl"
                  }
                  onClick={() => setViewingAll(true)}
                >
                  All Tracked Accounts
                </h2>
                <h2
                  className={
                    !viewingAll
                      ? "text-center text-[#34BED3] text-3xl mt-[50px] underline hover:cursor-pointer rounded-xl p-3 bg-[#1C252E] w-[400px] self-center mt-[25px] hover:drop-shadow-2xl"
                      : "text-center text-3xl mt-[50px] hover:cursor-pointer rounded-xl p-3 bg-[#1C252E] w-[400px] self-center mt-[25px] hover:drop-shadow-2xl"
                  }
                  onClick={() => setViewingAll(false)}
                >
                  Banned Accounts
                </h2>
                <button
                  className="text-3xl rounded-xl p-3 bg-[#1C252E] w-[400px] self-center mt-[50px] active:bg-[#34BED3] hover:drop-shadow-2xl"
                  onClick={refreshTrackedAccounts}
                >
                  Refresh Accounts
                </button>
              </div>
            </div>
            <div>
              {cooldownError && (
                <h1 className="mt-[20px] text-red-600 text-center text-4xl">
                  Failed to refresh accounts: you must wait{" "}
                  {Math.floor(timeToRefresh / 60000)} minutes and{" "}
                  {((timeToRefresh % 60000) / 1000).toFixed(0)} seconds before
                  refreshing again.
                </h1>
              )}
              {refreshSuccess && (
                <h1 className="mt-[10px] text-green-600 text-center text-4xl">
                  Successfully refreshed accounts.&nbsp;
                  {foundBans
                    ? `Found ${numBansFound} new bans!`
                    : "No bans detected."}
                </h1>
              )}
            </div>
            <div className="mb-[50px] min-h-[64.2vh]">
              <div className="flex flex-row flex-wrap gap-[25px] mt-[50px] justify-center">
                {viewingAll && allTrackedAccountsDisplay}
                {!viewingAll && bannedTrackedAccountsDisplay}
              </div>
            </div>
            <p className="">&nbsp;</p>
          </div>
        </div>
        <div className="z-10 rotate-90 w-0 h-0 "></div>
      </main>
    </>
  );
}
