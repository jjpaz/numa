# Run using Windows PowerShell (powershell.exe), not the running web preview.
# Produces synthetic English speech for technical tests; never clinical evidence.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$fixtureRoot = Join-Path $PSScriptRoot '..\.local\ml-fixtures'
New-Item -ItemType Directory -Force -Path $fixtureRoot | Out-Null
$fixturePath = Join-Path (Resolve-Path -LiteralPath $fixtureRoot).Path 'synthetic-en.wav'
if (Test-Path -LiteralPath $fixturePath) {
    throw 'The synthetic fixture already exists; it has not been overwritten.'
}
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $englishVoice = $speaker.GetInstalledVoices() | Where-Object {
        $_.Enabled -and $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq 'en'
    } | Select-Object -First 1
    if (-not $englishVoice) { throw 'Install an English Windows speech voice first.' }
    $speaker.SelectVoice($englishVoice.VoiceInfo.Name)
    $speaker.Rate = -1
    $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
        16000,
        [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
        [System.Speech.AudioFormat.AudioChannel]::Mono
    )
    $speaker.SetOutputToWaveFile($fixturePath, $format)
    $speaker.Speak(@'
This is an artificial voice recording created for a software test. It does not
represent a patient, a personal journal, or a description of anyone's health.
Today the library opened at nine. A visitor returned a book about gardens and
borrowed a guide to local trees. Outside, a delivery van stopped near the corner.
Someone carried a box of apples into the cafe. The afternoon timetable listed
three trains and a bus. At home, there was a blue notebook on the kitchen table,
beside a pencil and a glass of water. Tomorrow the plan is to check the weather,
write a short shopping list, and choose a book for the weekend. This recording
exists only to check whether the audio pipeline and model run correctly.
'@)
    $speaker.SetOutputToNull()
    Write-Output 'Created synthetic English WAV in ignored .local/ml-fixtures/.'
} finally {
    $speaker.Dispose()
}
