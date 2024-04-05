const lcjs = require('@arction/lcjs')
const { lightningChart, Themes, emptyFill, PalettedFill, LUT, AxisTickStrategies, AxisScrollStrategies, emptyLine, regularColorSteps } =
    lcjs

const exampleContainer = document.getElementById('chart') || document.body
if (exampleContainer === document.body) {
    exampleContainer.style.width = '100vw'
    exampleContainer.style.height = '100vh'
    exampleContainer.style.margin = '0px'
}

const lc = lightningChart({
            resourcesBaseUrl: new URL(document.head.baseURI).origin + new URL(document.head.baseURI).pathname + 'resources/',
        })

const temporaryPanelAtStart = lc.UIPanel({
    container: exampleContainer,
    theme: Themes[new URLSearchParams(window.location.search).get('theme') || 'darkGold'] || undefined,
})
const ui = temporaryPanelAtStart.addUIElement().setPadding(12).setText('Click anywhere to start playing audio').setMouseInteractions(false)
temporaryPanelAtStart.onBackgroundMouseClick((_) => startAudioVisualization())
const theme = temporaryPanelAtStart.getTheme()

const startAudioVisualization = () => {
    temporaryPanelAtStart.dispose()
    const containerChart1 = document.createElement('div')
    const containerChart2 = document.createElement('div')
    exampleContainer.append(containerChart1)
    exampleContainer.append(containerChart2)
    containerChart1.style.width = '100%'
    containerChart1.style.height = '50%'
    containerChart2.style.width = '100%'
    containerChart2.style.height = '50%'

    // Loosely based on: https://blog.logrocket.com/audio-visualizer-from-scratch-javascript/
    let audio1 = new Audio()
    audio1.src =
        new URL(document.head.baseURI).origin + new URL(document.head.baseURI).pathname + 'examples/assets/0039/alex-productions-noise.mp3'
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    let audioSource = null
    let analyser = null
    audioSource = audioCtx.createMediaElementSource(audio1)
    analyser = audioCtx.createAnalyser()
    audioSource.connect(analyser)
    analyser.connect(audioCtx.destination)
    analyser.fftSize = 128
    audio1.play()
    const bufferLength = analyser.frequencyBinCount

    // (1) Frequency visualization
    const chartFrequency = lc
        .ChartXY({
            container: containerChart1,
        })
        .setTitle('Alex-Productions - Noise')
        .setTitlePosition('series-right-top')
        .setPadding(30)
        .setMouseInteractions(false)
    const palette = new PalettedFill({
        lookUpProperty: 'y',
        lut: new LUT({
            interpolate: true,
            steps: regularColorSteps(0, 200, theme.examples.spectrogramColorPalette),
        }),
    })
    const seriesFrequency = chartFrequency
        .addPointLineAreaSeries({ dataPattern: 'ProgressiveX' })
        .setCurvePreprocessing({ type: 'spline', resolution: 10 })
        .setPointFillStyle(emptyFill)
        .setAreaFillStyle(palette)
        .setCursorEnabled(false)
    const axisY = chartFrequency.getDefaultAxisY().setInterval({ start: 0, end: 256 })
    chartFrequency.forEachAxis((axis) => axis.setTickStrategy(AxisTickStrategies.Empty).setMouseInteractions(false))

    // (2) Waveform
    const chartWaveform = lc
        .ChartXY({
            container: containerChart2,
        })
        .setTitle('')
        .setPadding(30)
    const seriesWaveform = chartWaveform
        .addPointLineAreaSeries({
            dataPattern: 'ProgressiveX',
            allowInputModification: false,
        })
        .setMaxSampleCount(100_000)
        .setPointFillStyle(emptyFill)
        .setAreaFillStyle(emptyLine)
        .setCursorEnabled(false)
    chartWaveform
        .getDefaultAxisX()
        .setScrollStrategy(AxisScrollStrategies.progressive)
        .setTickStrategy(AxisTickStrategies.Time)
        .setDefaultInterval((state) => ({
            start: (state.dataMax ?? 0) - 5_000,
            end: state.dataMax,
            stopAxisAfter: false,
        }))
        .fit(false)
    chartWaveform.getDefaultAxisY().setAnimationScroll(false).setChartInteractionZoomByWheel(false)
    chartWaveform.getDefaultAxisY().setTickStrategy(AxisTickStrategies.Empty)
    chartWaveform.getDefaultAxisX().setTickStrategy(AxisTickStrategies.Time)

    //
    const dataArrayFrequency = new Uint8Array(bufferLength)
    const dataArrayTimeDomain = new Float32Array(analyser.fftSize)
    let tPrev = undefined
    const tFirst = performance.now()
    let framesCount = 0
    const title = chartFrequency.getTitle()
    const frame = () => {
        const tNow = performance.now()
        if (tPrev) {
            analyser.getByteFrequencyData(dataArrayFrequency)
            analyser.getFloatTimeDomainData(dataArrayTimeDomain)
            seriesFrequency.clear().appendSamples({
                yValues: dataArrayFrequency,
            })
            const waveformTimestamps = new Array(dataArrayTimeDomain.length)
                .fill(0)
                .map((_, i, arr) => tPrev + ((tNow - tPrev) * (i + 1)) / arr.length)
            seriesWaveform.appendSamples({
                xValues: waveformTimestamps,
                yValues: dataArrayTimeDomain,
            })
            chartWaveform.getDefaultAxisX().setStopped(false)

            const fps = 1000 / ((tNow - tFirst) / framesCount)
            chartFrequency.setTitle(`${title} - ${fps.toFixed(0)} FPS`)
        }
        requestAnimationFrame(frame)
        tPrev = tNow
        framesCount += 1
    }
    frame()
}
