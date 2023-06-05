// @ts-nocheck

import Head from "next/head";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "@supabase/auth-helpers-react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";

export default function Index() {
  const router = useRouter();
  const session = useSession();
  const supabase = useSupabaseClient();
  const [loginForm, setLoginForm] = useState({ email: "", pass: "" });
  const [registerForm, setRegisterForm] = useState({
    pass: "",
    email: "",
  });
  const [loggingIn, setLoggingIn] = useState(false);
  const [signedUp, setSignedUp] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [signinError, setSigninError] = useState(false);
  const [genericError, setGenericError] = useState(false);
  const [cooldownError, setCooldownError] = useState(false);

  useEffect(() => {
    if (session) {
      router.push("/home");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function handleLogin(event) {
    setSigninError(false);
    event.preventDefault();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginForm.email,
      password: loginForm.pass,
    });
    if (error) {
      setSigninError(true);
    } else if (data) {
      router.push({
        pathname: "/home",
      });
    } else {
      throw new Error("supabase auth failed with no error");
    }
  }

  function handleLoginChange(event) {
    const { name, value } = event.target;
    setLoginForm((oldForm) => {
      return {
        ...oldForm,
        [name]: value,
      };
    });
  }

  function clearErrors() {
    setEmailError(false);
    setGenericError(false);
    setPasswordError(false);
    setCooldownError(false);
    setSigninError(false);
  }

  async function handleRegister(event) {
    event.preventDefault();
    clearErrors();
    const { data, error } = await supabase.auth.signUp({
      email: registerForm.email,
      password: registerForm.pass,
    });
    if (error) {
      console.log(`sign up error: ${JSON.stringify(error, null, 2)}`);
      if (error.message === "Password should be at least 6 characters") {
        setPasswordError(true);
      } else if (
        error.message === "Unable to validate email address: invalid format"
      ) {
        setEmailError(true);
      } else if (error.message.includes("For security purposes")) {
        setCooldownError(true);
      } else {
        setGenericError(true);
      }
    } else {
      setSignedUp(true);
    }
  }

  function handleRegisterChange(event) {
    const { name, value } = event.target;
    setRegisterForm((oldForm) => {
      return {
        ...oldForm,
        [name]: value,
      };
    });
  }

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
        <div className="flex text-white font-inter">
          <div className="bg-[#1C252E] w-[50%] h-[100vh]">
            <div className="flex flex-col items-center justify-center gap-y-[45px] h-full">
              <Image
                alt="An image of some tracked accounts"
                src="/img/all_accounts.png"
                width={799}
                height={392}
                className="rounded-3xl"
              />
              <Image
                alt="An image of some tracked accounts that were banned"
                src="/img/banned_accounts.png"
                width={799}
                height={392}
                className="rounded-3xl"
              />
            </div>
          </div>
          <div className="flex flex-col items-center w-[50%] bg-main h-[100vh]">
            <div className="w-[90%] mt-[25px]">
              <h1 className="text-[90px] text-center">VacTrack</h1>
              <p className="text-[25px]">
                VacTrack is a website for tracking suspicious gamers on Steam.
                Want to know if that account you reported in-game got banned
                without manually tracking them in a spreadsheet or checking your
                recent games? Simply insert the link to their profile or Steam
                ID and VacTrack will start tracking their ban status.
              </p>
            </div>

            {!loggingIn && (
              <div className="flex flex-col items-center mt-[90px]">
                <h2 className="text-[30px] mb-[25px]">Create an account</h2>
                <form
                  onSubmit={(e) => handleRegister(e)}
                  className="flex flex-col items-center gap-y-[40px]"
                >
                  <label>
                    <input
                      type="text"
                      onChange={(e) => handleRegisterChange(e)}
                      value={registerForm.email}
                      name="email"
                      className="rounded-[12px] h-[62px] w-[420px] bg-[#D9D9D9] text-form-text pl-[10px] text-[30px] placeholder-form-text"
                      placeholder="Email"
                    />
                  </label>
                  <label>
                    <input
                      type="password"
                      onChange={(e) => handleRegisterChange(e)}
                      value={registerForm.pass}
                      name="pass"
                      className="rounded-[12px] h-[62px] w-[420px] bg-[#D9D9D9] text-form-text pl-[10px] text-[30px] placeholder-form-text"
                      placeholder="Password (>= 6 characters)"
                    />
                  </label>
                  <button className="bg-[#B6CFFF] rounded-[40px] py-[14px] px-[54px] text-black font-bold">
                    CREATE ACCOUNT
                  </button>
                  {genericError && (
                    <p className="text-red-600 text-[20px] font-bold">
                      An unknown error occurred. Please try again later.
                    </p>
                  )}
                  {passwordError && (
                    <p className="text-red-600 text-[20px] font-bold">
                      Please provide at least 6 characters for password.
                    </p>
                  )}
                  {emailError && (
                    <p className="text-red-600 text-[20px] font-bold">
                      Invalid email. Please double check the email field or use
                      a different email.
                    </p>
                  )}
                  {cooldownError && (
                    <p className="text-red-600 text-[20px] font-bold">
                      Please check your email for verification link.
                    </p>
                  )}
                  {signedUp && (
                    <p className="text-green-600 text-[20px] font-bold">
                      Sign up successful. Please verify your account via the
                      link sent to your email before logging in.
                    </p>
                  )}
                </form>
                <p
                  className="hover:underline hover:cursor-pointer mt-[32px]"
                  onClick={() => {
                    clearErrors();
                    setLoggingIn((old) => !old);
                    setRegisterForm({
                      pass: "",
                      email: "",
                    });
                  }}
                >
                  Already a member? Log in
                </p>
              </div>
            )}
            {loggingIn && (
              <div className="flex flex-col items-center mt-[90px]">
                <h2 className="text-[30px] mt-[25px] mb-[25px]">Log in</h2>
                <form
                  onSubmit={(e) => handleLogin(e)}
                  className="flex flex-col items-center gap-y-[40px]"
                >
                  <label>
                    <input
                      type="text"
                      onChange={(e) => handleLoginChange(e)}
                      value={loginForm.email}
                      name="email"
                      placeholder="Email"
                      className="rounded-[12px] h-[62px] w-[420px] bg-[#D9D9D9] text-form-text pl-[10px] text-[30px] placeholder-form-text"
                    />
                  </label>
                  <label>
                    <input
                      type="password"
                      onChange={(e) => handleLoginChange(e)}
                      value={loginForm.pass}
                      name="pass"
                      placeholder="Password"
                      className="rounded-[12px] h-[62px] w-[420px] bg-[#D9D9D9] text-form-text pl-[10px] text-[30px] placeholder-form-text"
                    />
                  </label>
                  <button className="bg-[#B6CFFF] rounded-[40px] py-[14px] px-[54px] text-black font-bold">
                    SIGN IN
                  </button>
                </form>
                <p
                  onClick={() => {
                    clearErrors();
                    setLoggingIn((old) => !old);
                    setLoginForm({ email: "", pass: "" });
                  }}
                  className="hover:underline hover:cursor-pointer mt-[32px]"
                >
                  No account? Register
                </p>
                {signinError && (
                    <p className="text-red-600 text-[20px] font-bold">
                      Please check your credentials.
                    </p>
                  )}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
