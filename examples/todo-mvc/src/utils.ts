export function uuid(): string {
  var i, random
  var uuid = ''

  for (i = 0; i < 32; i++) {
    random = (Math.random() * 16) | 0
    if (i === 8 || i === 12 || i === 16 || i === 20) {
      uuid += '-'
    }
    // eslint-disable-next-line
    uuid += (i === 12 ? 4 : i === 16 ? (random & 3) | 8 : random).toString(16)
  }

  return uuid
}

export async function sleep(timeout: number) {
  return new Promise(r => setTimeout(r, timeout))
}

export const repeat = (str: string, times: number) =>
  new Array(times + 1).join(str)

export const pad = (num: number, maxLength: number) =>
  repeat('0', maxLength - num.toString().length) + num

export const formatTime = (time: Date) =>
  `${pad(time.getHours(), 2)}:${pad(time.getMinutes(), 2)}:${pad(
    time.getSeconds(),
    2
  )}.${pad(time.getMilliseconds(), 3)}`
