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
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
