//
//  styling.swift
//  mobileTDG
//
//  Created by Diya Baliga on 12/1/20.
//

import SwiftUI

// creates checkbox style for toggle components
struct CheckboxToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        return HStack {
            configuration.label
            Spacer()
            Image(systemName: configuration.isOn ? "checkmark.square" : "square")
                .resizable()
                .frame(width: 25, height: 25)

                .onTapGesture { configuration.isOn.toggle() }
        }
    }
}

struct LabellessToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        return HStack {
            Image(systemName: configuration.isOn ? "checkmark.circle.fill" : "circle")
                .resizable()
                .frame(width: 25, height: 25)
                .foregroundColor(configuration.isOn ? .blue : .gray)
                .onTapGesture { configuration.isOn.toggle() }
        }
    }
}

struct dataGridTitle: View {
    var body: some View {
        Text("the data grid")
            .font(Font.custom("IBMPlexSans-Regular", size: 40, relativeTo: Font.TextStyle.largeTitle))
            .multilineTextAlignment(.center)
    }
}

struct globeLogo: View {
    var body: some View {
        Image(decorative: "TDG-globe").padding()
    }
}
