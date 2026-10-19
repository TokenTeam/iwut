sentry_search_paths = Pod::Specification.from_file(
  File.join(File.dirname(`bun --print "require.resolve('@sentry/react-native/package.json')"`.strip), 'RNSentry.podspec')
).attributes_hash.fetch('pod_target_xcconfig', {}).select do |key, _|
  key.start_with?('FRAMEWORK_SEARCH_PATHS', 'SENTRY_MACOS_SLICE')
end

Pod::Spec.new do |s|
  s.name           = 'Telemetry'
  s.version        = '1.0.0'
  s.summary        = '.'
  s.homepage       = 'https://github.com/tokenteam/iwut'
  s.author         = 'tokenteam'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }

  s.dependency 'ExpoModulesCore'
  s.dependency 'RNSentry'

  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = sentry_search_paths.merge('DEFINES_MODULE' => 'YES')
end
