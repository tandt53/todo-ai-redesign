// Metro for the simulator shell. The app code is NOT here — it lives in the
// project's own src/assistant/mobile/, which metro must watch.
//
// The only real hazard is duplication: files under ../src would otherwise
// resolve react / react-native from the REPO ROOT's node_modules (RN 0.87),
// while the shell runs RN 0.86 — two copies of React in one bundle crashes on
// the first hook. So those four packages are pinned to the shell, and
// everything else keeps normal hierarchical resolution (expo's own deps are
// nested under expo/node_modules and disabling that lookup breaks the bundle).
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const shell = __dirname
const repo = path.resolve(shell, '..')
const config = getDefaultConfig(shell)
const mod = (name) => path.join(shell, 'node_modules', name)

// `docs/design/` is watched too: model/theme.ts imports docs/design/_shared/tokens.json
// directly, so the app reads design's real colour tokens rather than a copy.
config.watchFolders = [path.join(repo, 'src'), path.join(repo, 'design')]
config.resolver.nodeModulesPaths = [path.join(shell, 'node_modules')]
config.resolver.extraNodeModules = {
  react: mod('react'),
  'react-native': mod('react-native'),
  'react-native-svg': mod('react-native-svg'),
  'lucide-react-native': mod('lucide-react-native'),
}
// The source imports siblings with an explicit `.ts` / `.tsx` extension
// (`from './controller.ts'`), which metro does not resolve. Map those back
// onto the real module rather than editing ~40 import statements in src/.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (/^\.{1,2}\/.*\.tsx?$/.test(moduleName)) {
    return context.resolveRequest(context, moduleName.replace(/\.tsx?$/, ''), platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}
module.exports = config
