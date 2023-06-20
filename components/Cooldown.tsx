export default function Cooldown({ time }: { time: number }) {
  return (
    <div className="w-[500px] h-[50px] bg-gray-200 text-black rounded-xl text-center">
      <p>
        You must wait {Math.floor(time / 60000)} minutes and{" "}
        {((time % 60000) / 1000).toFixed(0)} seconds before refreshing accounts
        again.
      </p>
    </div>
  );
}
