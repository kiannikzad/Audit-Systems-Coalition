//
//  mobileTDGApp.swift
//  mobileTDG
//
//  Created by Diya Baliga on 11/15/20.
//

import SwiftUI

@main
struct mobileTDGApp: App {
    @StateObject var viewRouter = ViewRouter()
    
    var body: some Scene {
        WindowGroup {
            motherView().environmentObject(viewRouter)
        }
    }
}
