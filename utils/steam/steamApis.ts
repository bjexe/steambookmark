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

export {queryBans, queryID, queryPlayerDetails};