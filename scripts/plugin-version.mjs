// 세 앱 플러그인 포장의 버전을 한 번에 바꾼다. 사용법: node scripts/plugin-version.mjs 0.4.5
import {
  readPackaging,
  setPackagingVersion,
  writePackageVersions,
} from './plugin-packaging.mjs'

const version = process.argv[2]
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('버전을 0.4.5 처럼 숫자 세 개로 넣어 주세요.')
  process.exit(1)
}
await writePackageVersions(setPackagingVersion(await readPackaging(), version))
console.log(`플러그인 버전을 ${version} 으로 바꿨습니다.`)
