const Signer = require("./index");
const http = require("http");
const axios = require("axios");
const PORT = process.env.PORT || 8080;
(async function main() {
  try {
    const signer = new Signer();
    const start = new Date();

    const server = http
        .createServer()
        .listen(PORT)
        .on("listening", function () {
          console.log("TikTok Signature server started on PORT " + PORT);
        });

    // Uncomment if you want to auto-exit this application after a period of time
    // If you use PM2 or Supervisord, it will attempt to open it
    // setTimeout(function () {
    //   server.close(() => {
    //     console.log("Server shutdown completed.");
    //     process.exit(1);
    //   });
    // }, 1 * 60 * 60 * 1000);

    signer.init();

    server.on("request", (request, response) => {
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader("Access-Control-Allow-Headers", "*");

      if (request.method === "OPTIONS") {
        response.writeHead(200);
        response.end();
        return;
      }

      if (request.method === "POST" && request.url === "/signature") {
        var url = "";
        request.on("data", function (chunk) {
          url += chunk;
        });

        request.on("end", async function () {
          console.log("Received url: " + url);

          try {
            const sign = await signer.sign(url);
            const navigator = await signer.navigator();

            let output = JSON.stringify({
              status: "ok",
              data: {
                ...sign,
                navigator: navigator,
              },
            });
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(output);
            console.log(output);
          } catch (err) {
            console.log(err);
            // Uncomment if you want to auto-exit this application when an error thrown
            // If you use PM2 or Supervisord, it will attempt to open it
            // var timeElapsed = new Date() - start;
            // console.info("Execution time: %dms", timeElapsed);
            // if (timeElapsed > 2500) {
            //   process.exit(1);
            // }
          }
        });
      } else if (request.method === "POST" && request.url === "/signature_video") {
        var SEC_UID = "";
        request.on("data", function (chunk) {
          SEC_UID += chunk.toString();
        });
        console.log(SEC_UID);
        request.on("end", async function () {

          // We use Apple, based on the issue comments in the repo, this helps prevent TikTok's captcha from triggering
          const TT_REQ_USER_AGENT =
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.56";

          // This the final URL you make a request to for the API call, it is ALWAYS this, do not mistaken it for the signed URL
          const TT_REQ_PERM_URL =
              "https://www.tiktok.com/api/post/item_list/?aid=1988&app_language=en&app_name=tiktok_web&battery_info=1&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=Win32&browser_version=5.0%20%28Windows%20NT%2010.0%3B%20Win64%3B%20x64%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F107.0.0.0%20Safari%2F537.36%20Edg%2F107.0.1418.56&channel=tiktok_web&cookie_enabled=true&device_id=7165118680723998214&device_platform=web_pc&focus_state=true&from_page=user&history_len=3&is_fullscreen=false&is_page_visible=true&os=windows&priority_region=RO&referer=&region=RO&screen_height=1440&screen_width=2560&tz_name=Europe%2FBucharest&webcast_language=en&msToken=G3C-3f8JVeDj9OTvvxfaJ_NppXWzVflwP1dOclpUOmAv4WmejB8kFwndJufXBBrXbeWNqzJgL8iF5zn33da-ZlDihRoWRjh_TDSuAgqSGAu1-4u2YlvCATAM2jl2J1dwNPf0_fk9dx1gJxQ21S0=&X-Bogus=DFSzswVYxTUANS/JS8OTqsXyYJUo&_signature=_02B4Z6wo00001CoOkNwAAIDBCa--cQz5e0wqDpRAAGoE8f";

          const PARAMS = {
            aid: "1988",
            count: 30,
            secUid: SEC_UID,
            cursor: 0,
            cookie_enabled: true,
            screen_width: 0,
            screen_height: 0,
            browser_language: "",
            browser_platform: "",
            browser_name: "",
            browser_version: "",
            browser_online: "",
            timezone_name: "Europe/London",
          };
          console.log(PARAMS);
          try {
            const signer2 = new Signer(null, TT_REQ_USER_AGENT);
            await signer2.init();

            const qsObject = new URLSearchParams(PARAMS);
            const qs = qsObject.toString();

            const unsignedUrl = `https://m.tiktok.com/api/post/item_list/?${qs}`;
            const signature2 = await signer2.sign(unsignedUrl);
            const navigator2 = await signer2.navigator();
            await signer2.close();

            // We don't take the `signed_url` from the response, we use the `x-tt-params` header instead because TikTok has
            // some weird security considerations. I'm not sure if it's a local encode or they actually make a call to their
            // servers to get the signature back, but your API call params are in the `x-tt-params` header, which is used
            // when making the request to the static URL `TT_REQ_PERM_URL` above. I'm assuming because the library launches
            // a headless browser, it's a local encode.
            const { "x-tt-params": xTtParams } = signature2;
            const { user_agent: userAgent } = navigator2;

            const options = {
              method: "GET",
              headers: {
                "user-agent": userAgent,
                "x-tt-params": xTtParams,
                "Accept-Encoding": "gzip,deflate,compress"
              },
              url: TT_REQ_PERM_URL,
            };
            const resp = await axios(options).catch(function (error) {
              // handle error
              console.log(error);
              response.end();
            });
            const { data } = resp;
            let output = JSON.stringify({
              status: "ok",
              data: data,
            });

            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(output);
            console.log(output);

          } catch (err) {
            console.log(err);
            // Uncomment if you want to auto-exit this application when an error thrown
            // If you use PM2 or Supervisord, it will attempt to open it
            // var timeElapsed = new Date() - start;
            // console.info("Execution time: %dms", timeElapsed);
            // if (timeElapsed > 2500) {
            //   process.exit(1);
            // }
          }
        });
      } else {
        response.statusCode = 404;
        response.end();
      }


    });

    await signer.close();
  } catch (err) {
    console.error(err);
  }
})();